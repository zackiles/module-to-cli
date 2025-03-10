/**
 * @module publish-pipeline
 * @description Publication workflow and transaction handling for the publishing process
 */

import {
  BumpType,
  ChangelogUpdateResult,
  ConfigUpdateResult,
  GitReleaseResult,
  JSRPublishResult,
  PublishOptions,
  PublishResult,
  StepResultType,
  TransactionStep,
} from './publish-types.ts'
import { CHANGELOG_FILE, updateChangelog } from './publish-changelog.ts'
import {
  analyzeCommitHistory,
  createGitRelease,
  rollbackGitChanges,
} from './publish-git.ts'
import { findConfigFile, parseConfig, updateVersion } from './publish-config.ts'
import { determineBumpType } from './publish-version.ts'
import { log } from './publish-log.ts'
import {
  fileExists,
  getErrorMessage,
  incrementVersion,
  readTextFile,
  runCommand,
  writeTextFile,
} from './publish-utils.ts'

/**
 * Transaction model for atomic operations with rollback capability.
 * Each step has:
 * - execute: Function to perform the step
 * - rollback: Function to undo the step if a later step fails
 * - requiresRollback: Flag indicating if this step needs to be rolled back (set after execution)
 */

/**
 * Execute steps in a transaction-like manner with rollback support
 * @param steps Array of transaction steps to execute
 * @returns Result of the final step or undefined if any step failed
 */
async function executeTransaction<T>(
  steps: TransactionStep<T>[],
): Promise<{ success: boolean; result?: T; error?: string }> {
  // Execute steps
  for (const step of steps) {
    try {
      log.info(`Executing step: ${step.name}`)
      step.result = await step.execute()
      step.requiresRollback = true
    } catch (error) {
      // Step failed, roll back all previous steps
      const errorMessage = getErrorMessage(error)
      log.error(`Step "${step.name}" failed: ${errorMessage}`)

      await rollbackSteps(steps)

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  // All steps executed successfully
  const lastStep = steps[steps.length - 1]
  return {
    success: true,
    result: lastStep.result,
  }
}

// Helper function to roll back completed steps
async function rollbackSteps<T>(steps: TransactionStep<T>[]): Promise<void> {
  // Roll back steps in reverse order
  for (const step of [...steps].reverse()) {
    if (step.requiresRollback) {
      try {
        log.info(`Rolling back step: ${step.name}`)
        await step.rollback()
      } catch (rollbackError) {
        const rollbackErrorMsg = getErrorMessage(rollbackError)
        log.error(
          `Error during rollback of "${step.name}": ${rollbackErrorMsg}`,
        )
        // Continue with other rollbacks even if one fails
      }
    }
  }
}

/**
 * Publish the package to JSR
 * @param dryRun Don't actually publish, just validate
 * @param allowDirty Allow publishing with uncommitted changes
 * @returns Whether the publication was successful
 */
async function publishToJSR(
  dryRun = false,
  allowDirty = false,
): Promise<boolean> {
  const publishArgs = ['publish']

  // Add flags based on options
  if (dryRun) {
    publishArgs.push('--dry-run')
  }

  if (allowDirty) {
    publishArgs.push('--allow-dirty')
  }

  const cmdString = `deno ${publishArgs.join(' ')}`
  log.debug(`Constructed command: ${cmdString} (allowDirty=${allowDirty})`)

  if (dryRun) {
    log.info('[DRY RUN] Validating publication...')
    log.debug(`Executing: ${cmdString}`)
    const dryRunSuccess = await runCommand('deno', publishArgs)
    if (dryRunSuccess) {
      log.info('[DRY RUN] Validation successful')
      return true
    } else {
      log.error('[DRY RUN] Publication validation failed')
      return false
    }
  } else {
    log.info('Publishing to JSR...')
    return await runCommand('deno', publishArgs)
  }
}

/**
 * Main publication process
 * @param options Publication options (dryRun, skipPublish, changelogPath, configFiles)
 * @returns Publication result
 */
async function publishPackage(
  options: PublishOptions = {},
): Promise<PublishResult> {
  // Extract options with defaults
  const {
    dryRun = false,
    skipPublish = false,
    allowDirty = false,
    changelogPath = CHANGELOG_FILE,
    configFiles,
  } = options

  // Default result for early returns
  const defaultResult = {
    oldVersion: '0.0.0',
    newVersion: '0.0.0',
    bumpType: null as BumpType,
    success: false,
  }

  try {
    // Get existing config
    const config = await findConfigFile(configFiles)
    if (!config) {
      log.error('No configuration file found')
      return {
        ...defaultResult,
        success: false,
        errorMessage: 'No configuration file found',
      }
    }

    // Parse config to get current version
    const parsed = parseConfig(config.path, config.data)
    const currentVersion = parsed.version as string

    if (!currentVersion) {
      log.error('No version field found in config')
      return {
        ...defaultResult,
        success: false,
        errorMessage: 'No version field found in config',
      }
    }

    // Analyze commits to determine if release should be skipped
    const { messages, skipRelease, error } = await analyzeCommitHistory()

    if (skipRelease) {
      log.notice('Skipping release based on commit messages')
      return {
        ...defaultResult,
        oldVersion: currentVersion,
        newVersion: currentVersion,
        success: true,
      }
    }

    if (error) {
      log.error(`Error analyzing commits: ${error}`)
      return {
        ...defaultResult,
        oldVersion: currentVersion,
        newVersion: currentVersion,
        success: false,
        errorMessage: error,
      }
    }

    // Determine bump type and next version
    const bump = determineBumpType(messages)

    if (!bump) {
      log.notice('No version bump needed based on commit messages')
      return {
        ...defaultResult,
        oldVersion: currentVersion,
        newVersion: currentVersion,
        success: true,
      }
    }

    // Calculate next version
    const nextVersionString = incrementVersion(currentVersion, bump)
    log.info(`Determined next version: ${nextVersionString} (${bump} bump)`)

    // Execute the publication steps as a transaction
    try {
      // Update version in config
      await updateVersion(nextVersionString, dryRun)

      // Update changelog
      const success = await updateChangelog(
        nextVersionString,
        messages,
        changelogPath,
        dryRun,
      )

      if (!success) {
        return {
          ...defaultResult,
          oldVersion: currentVersion,
          newVersion: nextVersionString,
          bumpType: bump,
          success: false,
          errorMessage: 'Failed to update changelog',
        }
      }

      // Define the transaction steps
      const pipelineSteps: TransactionStep<StepResultType>[] = [
        // Step 1: Update config file
        {
          name: 'Update version in config file',
          requiresRollback: false,
          execute: async () => {
            const originalContent = await readTextFile(config.path)
            await updateVersion(nextVersionString, dryRun)
            return {
              originalContent: originalContent ?? '',
              updatedPath: config.path,
            } as ConfigUpdateResult
          },
          rollback: async () => {
            const result = pipelineSteps[0].result as
              | ConfigUpdateResult
              | undefined
            if (result) {
              log.info(`Rolling back config changes to ${config.path}`)
              await writeTextFile(config.path, result.originalContent, false)
            }
          },
        },

        // Step 2: Update changelog
        {
          name: 'Update changelog',
          requiresRollback: false,
          execute: async () => {
            // Check if changelog exists
            const fileExistedBefore = await fileExists(changelogPath)
            const originalContent = fileExistedBefore
              ? await readTextFile(changelogPath) ?? ''
              : ''

            await updateChangelog(
              nextVersionString,
              messages,
              changelogPath,
              dryRun,
            )

            return {
              originalContent,
              fileExistedBefore,
              path: changelogPath,
            } as ChangelogUpdateResult
          },
          rollback: async () => {
            const result = pipelineSteps[1].result as
              | ChangelogUpdateResult
              | undefined

            if (result) {
              log.info(`Rolling back changelog changes to ${changelogPath}`)
              if (result.fileExistedBefore) {
                await writeTextFile(
                  changelogPath,
                  result.originalContent,
                  false,
                )
              } else {
                await Deno.remove(changelogPath)
              }
            }
          },
        },

        // Step 3: Create git release (commit, tag, push)
        {
          name: 'Create git release',
          requiresRollback: false,
          execute: async () => {
            if (dryRun) {
              log.info(
                `[DRY RUN] Would commit, tag, and push version ${nextVersionString}`,
              )
              return {
                tagName: `v${nextVersionString}`,
                currentHead: 'dry-run',
              }
            }

            const result = await createGitRelease(nextVersionString, [
              config.path,
              changelogPath,
            ])
            return result as GitReleaseResult
          },
          rollback: () => {
            if (dryRun) return

            const result = pipelineSteps[2].result as
              | GitReleaseResult
              | undefined
            if (result) {
              log.info(
                `Rolling back git changes (tag: ${result.tagName}, head: ${result.currentHead})`,
              )
              return rollbackGitChanges(result.tagName, result.currentHead)
            }
          },
        },

        // Step 4: Publish to JSR
        {
          name: 'Publish to JSR',
          requiresRollback: false,
          execute: async () => {
            if (skipPublish) {
              log.info('Skipping JSR publication (--skip-publish flag)')
              return { published: false } as JSRPublishResult
            }

            // First do a dry-run to validate
            log.info('Validating publication...')
            log.debug(`Using allowDirty=${allowDirty} for validation`)
            try {
              const validationSuccess = await publishToJSR(true, allowDirty)
              if (!validationSuccess) {
                throw new Error(
                  'Dry run of publication failed. Fix the issues before publishing',
                )
              }
            } catch (error) {
              return { published: false } as JSRPublishResult
            }

            // If not just a dry run, do the actual publication
            if (!dryRun) {
              log.info('Publishing to JSR...')
              const publishSuccess = await publishToJSR(false, allowDirty)
              if (publishSuccess) {
                log.notice(
                  `Successfully published version ${nextVersionString} to JSR!`,
                )
              } else {
                throw new Error('Failed to publish to JSR')
              }
            }

            return { published: true } as JSRPublishResult
          },
          rollback: () => {
            log.warning(
              'Cannot roll back JSR publication. Please unpublish manually if needed.',
            )
          },
        },
      ]

      // Execute all steps
      const txResult = await executeTransaction(pipelineSteps)

      if (txResult.success) {
        return {
          oldVersion: currentVersion,
          newVersion: nextVersionString,
          bumpType: bump,
          success: true,
        }
      } else {
        return {
          oldVersion: currentVersion,
          newVersion: nextVersionString,
          bumpType: bump,
          success: false,
          errorMessage: txResult.error,
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      log.error(`Error during publication: ${errorMessage}`)
      return {
        oldVersion: currentVersion,
        newVersion: nextVersionString,
        bumpType: bump,
        success: false,
        errorMessage,
      }
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    log.error(`Unhandled error: ${errorMessage}`)

    return {
      ...defaultResult,
      success: false,
      errorMessage: `Unhandled error: ${errorMessage}`,
    }
  }
}

export { publishPackage }
