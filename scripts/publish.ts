#!/usr/bin/env -S deno run --allow-all --ext=ts

/**
 * @module publish
 * @description Automated Deno & JSR release flow that implements semantic versioning
 * based on conventional commit messages.
 *
 * This script:
 * - Analyzes commit messages for semantic versioning (major, minor, patch) indicators
 * - Updates version numbers in config files (deno.json, deno.jsonc, jsr.json)
 * - Generates or updates a structured CHANGELOG.md file
 * - Commits and tags the release
 * - Publishes to JSR with a dry-run verification
 *
 * @example
 * ```ts
 * // Run as command line
 * deno run --allow-run --allow-read --allow-write --allow-env ./scripts/publish.ts
 *
 * // Use as a library
 * import { determineNextVersion, generateChangelog, publishPackage } from "./scripts/publish.ts";
 *
 * // Get the next version based on commit messages
 * const nextVersion = await determineNextVersion();
 * if (nextVersion) {
 *   // Generate a changelog for this version
 *   await generateChangelog(nextVersion, commits);
 *   // Publish the new version
 *   await publishPackage(nextVersion);
 * }
 * ```
 *
 * @license MIT
 */

// Remote imports
import { parseArgs } from '@std/cli'

// Local imports
import { publishPackage } from './publish-pipeline.ts'
import { log } from './publish-log.ts'

// Re-export all functionality from the modular files
export * from './publish-config.ts'
export * from './publish-changelog.ts'
export * from './publish-version.ts'
export * from './publish-pipeline.ts'
export * from './publish-utils.ts'
export * from './publish-log.ts'

const HELP_TEXT = `
Usage: publish.ts [options]

Options:
  --dry-run, -d      Don't actually make changes, just report what would happen
  --skip-publish, -s Skip the JSR publication step
  --allow-dirty, -a  Allow publishing with uncommitted changes (automatically enabled in dry-run mode)
  --help, -h         Show this help message
`

/**
 * Main CLI entry point for the publication process
 *
 * Parses command line arguments and orchestrates the publication workflow.
 * The function handles:
 * - Processing CLI flags (--dry-run, --skip-publish, --help)
 * - Executing the actual publication process
 * - Handling success/failure outputs
 *
 * @returns {Promise<void>} A promise that resolves when publication is complete
 */
async function main(): Promise<void> {
  // Parse command line flags using @std/cli
  const args = parseArgs(Deno.args, {
    boolean: ['dry-run', 'help', 'skip-publish', 'allow-dirty'],
    alias: {
      d: 'dry-run',
      h: 'help',
      s: 'skip-publish',
      a: 'allow-dirty',
    },
  })

  // Check if the --allow-dirty flag was explicitly provided in the command line args
  const explicitAllowDirty = Deno.args.some((arg) =>
    arg === '--allow-dirty' ||
    arg === '-a' ||
    arg.startsWith('--allow-dirty=')
  )

  // Handle help flag
  if (args.help) {
    log.info(HELP_TEXT)
    Deno.exit(0)
  }

  const isDryRun = args['dry-run'] ?? false

  // If --allow-dirty was explicitly provided, use its exact value
  // Otherwise, in dry-run mode, default to true
  let isAllowDirty: boolean
  if (explicitAllowDirty) {
    isAllowDirty = args['allow-dirty']
  } else {
    isAllowDirty = isDryRun
  }

  // Run the publication process
  const result = await publishPackage({
    dryRun: isDryRun,
    skipPublish: args['skip-publish'] ?? false,
    allowDirty: isAllowDirty,
  })

  if (!result.success) {
    log.error(`Publication failed: ${result.errorMessage}`)
    Deno.exit(1)
  }

  log.notice(`Successfully published v${result.newVersion}`)
  Deno.exit(0)
}

// Add command line functionality if this module is run directly
if (import.meta.main) {
  await main()
}
