/**
 * @module publish-git
 * @description Git operations for the publishing process
 */

import { simpleGit } from 'simple-git'
import { getErrorMessage } from './publish-utils.ts'
import { log } from './publish-log.ts'

/**
 * Commit changes and create a tag for the new version
 * @param version Version to tag with
 * @param configPath Path to the config file that was updated
 * @param changelogPath Path to the changelog file
 * @param dryRun Don't actually make changes, just report
 */
async function commitAndTag(
  version: string,
  configPath: string,
  changelogPath: string,
  dryRun = false,
): Promise<void> {
  const git = simpleGit()
  const tag = `v${version}`

  if (dryRun) {
    log.info(`[DRY RUN] Would commit changes and tag as ${tag}`)
    return
  }

  try {
    await git.add([configPath, changelogPath])
    await git.commit(`chore(release): ${tag}`)
    await git.addTag(tag)
    await git.push('origin', tag)
    await git.push()
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    throw new Error(`Git operations failed: ${errorMessage}`)
  }
}

/**
 * Create a Git commit, tag, and push changes
 * @param version Version to tag
 * @param files Files to add to the commit
 * @returns Information about the commit and tag
 */
async function createGitRelease(
  version: string,
  files: string[],
): Promise<{ currentHead: string; tagName: string }> {
  const git = simpleGit()
  const tagName = `v${version}`

  // Remember current HEAD for potential rollback
  const currentHead = await git.revparse(['HEAD'])

  // Perform git operations
  await git.add(files)
  log.debug('Staged files for commit')

  await git.commit(`chore(release): ${tagName}`)
  log.info(`Created release commit for ${tagName}`)

  await git.addTag(tagName)
  log.info(`Created tag ${tagName}`)

  await git.push('origin', tagName)
  log.info(`Pushed tag ${tagName} to origin`)

  await git.push()
  log.info('Pushed commits to origin')

  log.notice(`Successfully committed, tagged, and pushed ${tagName}`)

  return {
    currentHead,
    tagName,
  }
}

/**
 * Roll back Git changes including tag and commits
 * @param tagName Name of the tag to delete
 * @param currentHead Commit hash to reset to
 */
async function rollbackGitChanges(
  tagName: string,
  currentHead: string,
): Promise<void> {
  const git = simpleGit()
  try {
    // Delete the tag locally and remotely
    await git.tag(['--delete', tagName])
    log.info(`Deleted local tag ${tagName}`)

    try {
      await git.push(['origin', '--delete', tagName])
      log.info(`Deleted remote tag ${tagName}`)
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      log.warning(`Could not delete remote tag ${tagName}: ${errorMessage}`)
    }

    // Reset to previous HEAD and force push
    await git.reset(['--hard', currentHead])
    log.info(`Reset to previous commit ${currentHead.substring(0, 7)}`)

    await git.push(['--force'])
    log.info('Force pushed to reset remote branch')
  } catch (e) {
    const errorMessage = getErrorMessage(e)
    log.error(`Error during git rollback: ${errorMessage}`)
    throw e
  }
}

/**
 * Analyze commit history to determine if a release should be skipped
 * @returns Object containing commit messages and skip status
 */
async function analyzeCommitHistory(): Promise<{
  messages: string[]
  skipRelease: boolean
  error?: string
}> {
  const git = simpleGit()
  let messages: string[] = []

  try {
    await git.checkIsRepo()
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    return {
      messages: [],
      skipRelease: true,
      error: `Not a git repository: ${errorMessage}`,
    }
  }

  // Gather recent commits
  log.info('Fetching recent commits...')

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
    const errorMessage = getErrorMessage(error)
    log.warning(`Error finding tags: ${errorMessage}. Analyzing all commits`)
    const logs = await git.log()
    messages = logs.all.map((log) => log.message)
  }

  // Check for skip release marker in any commit message
  const skipReleasePattern = /\[skip release\]/i
  for (const message of messages) {
    if (skipReleasePattern.test(message)) {
      log.notice('[skip release] found in commit message. Skipping publishing!')
      return {
        messages,
        skipRelease: true,
      }
    }
  }

  // Log the commits for debugging
  log.debug(`Found ${messages.length} commits to analyze`)
  messages.forEach((message, index) => {
    log.debug(`Commit ${index + 1}: ${message.split('\n')[0]}`)
  })

  return {
    messages,
    skipRelease: false,
  }
}

export {
  analyzeCommitHistory,
  commitAndTag,
  createGitRelease,
  rollbackGitChanges,
}
