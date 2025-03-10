/**
 * @module publish-version
 * @description Version calculation and determination for the publishing process
 */

import { simpleGit } from 'simple-git'
import { log } from './publish-log.ts'
import { findConfigFile, parseConfig } from './publish-config.ts'
import { getErrorMessage, incrementVersion } from './publish-utils.ts'
import { BumpType } from './publish-types.ts'

/**
 * Determine the type of version bump based on commit messages
 * @param messages Array of commit messages to analyze
 * @returns Type of version bump (major, minor, patch) or null if no bump needed
 */
const determineBumpType = (messages: string[]): BumpType => {
  let bump: BumpType = null

  for (const message of messages) {
    // Check for breaking changes (major bump)
    if (/(BREAKING CHANGE|![:]?)/.test(message)) {
      return 'major'
    }

    // Extract the type from conventional commit format
    const typeMatch = message.match(/^([a-z]+)(\([a-z-_/]+\))?!?:/)
    if (!typeMatch) continue

    const type = typeMatch[1]

    // Handle commit types according to semantic-release conventions
    switch (type) {
      case 'feat':
        // Features trigger minor releases
        bump = bump === 'major' ? 'major' : 'minor'
        break
      case 'fix':
      case 'perf':
        // Fixes and performance improvements trigger patch releases
        bump = bump === 'major' || bump === 'minor' ? bump : 'patch'
        break
      case 'refactor':
      case 'style':
      case 'docs':
      case 'test':
      case 'build':
      case 'ci':
      case 'chore':
        // These types don't trigger releases by default in semantic-release
        // unless they have breaking changes, which we already checked for
        break
      default:
        // Unknown types don't trigger releases
        break
    }
  }

  return bump
}

/**
 * Calculate the next version based on commit messages
 * @returns The next version string, or null if no version bump is needed
 */
const determineNextVersion = async (): Promise<string | null> => {
  const git = simpleGit()

  try {
    await git.checkIsRepo()
  } catch (error) {
    throw new Error(`Not a git repository: ${getErrorMessage(error)}`)
  }

  // Get the most recent tag or null if no tags exist
  let messages: string[] = []
  try {
    // Try to get the latest tag
    const tags = await git.tags()

    if (tags.all.length > 0) {
      // Get the most recent tag
      const latestTag = tags.latest
      log.info(`Found latest tag: ${latestTag}`)

      // Get commits since the latest tag
      const logs = await git.log({ from: latestTag, to: 'HEAD' })
      messages = logs.all.map((log) => log.message)
      log.info(`Analyzing ${messages.length} commits since tag ${latestTag}`)
    } else {
      // No tags exist, get all commits
      log.info('No tags found. Analyzing all commits')
      const logs = await git.log()
      messages = logs.all.map((log) => log.message)
    }
  } catch (error) {
    // Fall back to getting all commits if there's an error
    log.warning(
      `Error finding tags: ${getErrorMessage(error)}. Analyzing all commits`,
    )
    const logs = await git.log()
    messages = logs.all.map((log) => log.message)
  }

  // Determine bump type based on commit messages
  const bump = determineBumpType(messages)
  if (!bump) {
    return null
  }

  // Find the current version
  const config = await findConfigFile()
  if (!config) {
    throw new Error('No config file found')
  }

  const parsed = parseConfig(config.path, config.data)
  const currentVersion = (parsed.version ?? '0.0.0').toString()

  // Calculate the next version using the utility function
  return incrementVersion(currentVersion, bump)
}

// Export the functions
export { determineBumpType, determineNextVersion }
