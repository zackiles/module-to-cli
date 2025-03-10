/**
 * @module publish-changelog
 * @description Changelog generation and updating for the publishing process
 */

import { log } from './publish-log.ts'
import { simpleGit } from 'simple-git'
import { findConfigFile, parseConfig } from './publish-config.ts'
import {
  fileExists,
  getErrorMessage,
  readTextFile,
  writeTextFile,
} from './publish-utils.ts'

// Changelog constants
const CHANGELOG_FILE = 'CHANGELOG.md'

// Changelog template formats
const CHANGELOG_HEADER_TEMPLATE =
  '# CHANGELOG ({packageName})\n\nAll notable changes to this project will be documented in this file.\n\n'
const CHANGELOG_VERSION_TEMPLATE = '## [VERSION](TAG_URL)\n\nCHANGES\n\n'

/**
 * Get the package name from the config file
 * @returns The package name, or "unnamed-package" if not found
 */
async function getPackageName(): Promise<string> {
  try {
    const config = await findConfigFile()
    if (!config) {
      return 'unnamed-package'
    }

    const parsed = parseConfig(config.path, config.data)

    // Try different fields that might contain the package name
    // Use type assertions to handle the dynamic nature of the config
    const name = (parsed as { name?: unknown }).name ||
      (parsed as { package?: { name?: unknown } }).package?.name ||
      (parsed as { jsr?: { name?: unknown } }).jsr?.name

    if (name) {
      return String(name)
    }

    // If no name found, extract from directory name
    const path = Deno.cwd()
    const dirName = path.split('/').pop() || 'unnamed-package'
    return dirName
  } catch (error) {
    log.warning(`Error getting package name: ${error}`)
    return 'unnamed-package'
  }
}

/**
 * Get remote repository information to construct tag URLs
 * @returns Object with organization and repository name, or null if not available
 */
async function getRepoInfo(): Promise<{ org: string; repo: string } | null> {
  try {
    const git = simpleGit()

    // Get the remote URL for origin
    const remotes = await git.remote(['get-url', 'origin'])
    if (!remotes) {
      log.warning('No remote URL found')
      return null
    }

    // Parse the remote URL to extract org and repo
    const remoteUrl = remotes.trim()

    // Handle both HTTPS and SSH URLs
    let match
    if (remoteUrl.startsWith('https://')) {
      // Format: https://github.com/orgName/repoName.git
      match = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\.]+)/)
    } else if (remoteUrl.includes('@github.com')) {
      // Format: git@github.com:orgName/repoName.git
      match = remoteUrl.match(/github\.com[:|\/]([^\/]+)\/([^\/\.]+)/)
    }

    if (!match || match.length < 3) {
      log.warning(`Could not parse remote URL: ${remoteUrl}`)
      return null
    }

    return {
      org: match[1],
      repo: match[2].replace('.git', ''),
    }
  } catch (error) {
    log.warning(`Error getting repo info: ${error}`)
    return null
  }
}

/**
 * Generate a URL to the tag on GitHub
 * @param version Version string
 * @returns URL to the tag on GitHub, or just the version if repo info is not available
 */
async function generateTagUrl(version: string): Promise<string> {
  const repoInfo = await getRepoInfo()

  if (!repoInfo) {
    return version
  }

  return `https://github.com/${repoInfo.org}/${repoInfo.repo}/tree/v${version}`
}

/**
 * Group commit messages by their conventional commit type
 * @param messages Array of commit messages to group
 * @returns Object with commit types as keys and arrays of messages as values
 */
const groupCommitsByType = (
  messages: string[],
): Record<string, string[]> => {
  const groups: Record<string, string[]> = {
    breaking: [],
    feat: [],
    fix: [],
    perf: [],
    other: [],
  }

  for (const message of messages) {
    // Get the first line of the message to determine the type
    const firstLine = message.split('\n')[0].trim()

    // Skip if first line is empty
    if (!firstLine) continue

    // Check for breaking changes anywhere in the message (including body)
    if (/(BREAKING CHANGE|![:]?)/.test(message)) {
      groups.breaking.push(message)
      continue
    }

    // Extract the type from conventional commit format (from first line)
    const typeMatch = firstLine.match(/^([a-z]+)(\([a-z-_/]+\))?!?:/)
    if (!typeMatch) {
      // Skip non-conventional commit messages
      continue
    }

    const type = typeMatch[1]

    // Only include commit types that trigger a release
    switch (type) {
      case 'feat':
        groups.feat.push(message)
        break
      case 'fix':
        groups.fix.push(message)
        break
      case 'perf':
        groups.perf.push(message)
        break
      default:
        // Skip other commit types that don't trigger releases
        break
    }
  }

  return groups
}

/**
 * Update the changelog with new version information
 * @param version Version number to add to changelog
 * @param messages Commit messages to include in changelog
 * @param changelogPath Path to the changelog file
 * @param dryRun Don't actually write changes, just report
 * @returns True if successful, false otherwise
 */
const updateChangelog = async (
  version: string,
  messages: string[],
  changelogPath = CHANGELOG_FILE,
  dryRun = false,
): Promise<boolean> => {
  try {
    // Group commits by type
    const commitGroups = groupCommitsByType(messages)

    // Build changelog content with sections
    let changelogContent = ''

    // Add breaking changes first if any
    if (commitGroups.breaking.length > 0) {
      changelogContent += '### BREAKING CHANGES\n\n'
      for (const message of commitGroups.breaking) {
        changelogContent += `- ${message}\n`
      }
      changelogContent += '\n'
    }

    // Add features
    if (commitGroups.feat.length > 0) {
      changelogContent += '### Features\n\n'
      for (const message of commitGroups.feat) {
        changelogContent += `- ${message}\n`
      }
      changelogContent += '\n'
    }

    // Add fixes
    if (commitGroups.fix.length > 0) {
      changelogContent += '### Bug Fixes\n\n'
      for (const message of commitGroups.fix) {
        changelogContent += `- ${message}\n`
      }
      changelogContent += '\n'
    }

    // Add performance improvements
    if (commitGroups.perf.length > 0) {
      changelogContent += '### Performance Improvements\n\n'
      for (const message of commitGroups.perf) {
        changelogContent += `- ${message}\n`
      }
      changelogContent += '\n'
    }

    // Add other changes
    if (commitGroups.other.length > 0) {
      changelogContent += '### Other Changes\n\n'
      for (const message of commitGroups.other) {
        changelogContent += `- ${message}\n`
      }
      changelogContent += '\n'
    }

    // Generate tag URL for this version
    const tagUrl = await generateTagUrl(version)

    // Create version entry
    const versionEntry = CHANGELOG_VERSION_TEMPLATE
      .replace('VERSION', version)
      .replace('TAG_URL', tagUrl)
      .replace('CHANGES', changelogContent.trim())

    // Check if changelog already exists
    const changelogExists = await fileExists(changelogPath)

    if (changelogExists) {
      // Read existing changelog
      const currentContent = await readTextFile(changelogPath)
      if (!currentContent) {
        throw new Error(`Failed to read existing changelog: ${changelogPath}`)
      }

      // Find the position after the header to insert the new version
      // Look for the first occurrence of a version heading (## [...])
      const headerEndPos = currentContent.indexOf('## [')

      if (headerEndPos === -1) {
        // No version headings found, append to the end
        await writeTextFile(
          changelogPath,
          currentContent + versionEntry,
          dryRun,
        )
      } else {
        // Insert after the header but before the first version heading
        const newContent = currentContent.slice(0, headerEndPos) +
          versionEntry +
          currentContent.slice(headerEndPos)

        await writeTextFile(changelogPath, newContent, dryRun)
      }

      log.info(`Updated existing ${changelogPath}`)
    } else {
      // File doesn't exist, create it with header
      const packageName = await getPackageName()
      const header = CHANGELOG_HEADER_TEMPLATE.replace(
        '{packageName}',
        packageName,
      )
      const content = header + versionEntry
      await writeTextFile(changelogPath, content, dryRun)
      log.info(`Created new ${changelogPath} with package name: ${packageName}`)
    }

    return true
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    log.error(`Error updating changelog: ${errorMessage}`)
    return false
  }
}

// Export the functions and constants
export {
  CHANGELOG_FILE,
  CHANGELOG_HEADER_TEMPLATE,
  CHANGELOG_VERSION_TEMPLATE,
  updateChangelog,
}
