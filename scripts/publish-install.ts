#!/usr/bin/env -S deno run --allow-all --ext=ts

/**
 * @module publish-install
 * @description Installer script for the JSR publication workflow.
 *
 * This script:
 * - Verifies deno.json/deno.jsonc exists in the working directory
 * - Installs @deno-kit/publish package
 * - Adds publish tasks to the Deno configuration
 * - Optionally sets up GitHub Actions for automated publishing
 *
 * @example
 * ```bash
 * deno run --allow-all https://deno.land/x/publish/install.ts
 * # Or after cloning locally
 * deno run --allow-all ./scripts/publish-install.ts
 * ```
 *
 * @example
 * ```typescript
 * // Import and use as a library
 * import { setupJSRPublish } from "./scripts/publish-install.ts";
 *
 * // Call with options
 * await setupJSRPublish({
 *   dryRun: true,
 *   addWorkflow: true,
 *   silent: false
 * });
 * ```
 */

import { ensureDir, exists } from '@std/fs'
import { join } from '@std/path'
import { parseArgs } from '@std/cli'
import { promptSelect } from '@std/cli/unstable-prompt-select'
import { log } from './publish-log.ts'

const JSR_PUBLISH_WORKFLOW = `name: Release

on:
  workflow_run:
    workflows: ["CI"]
    branches: [main, master]
    types: 
      - completed

jobs:
  publish:
    if: \${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Setup Git user
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"

      - name: Run Publish Script
        run: deno run --allow-all ./scripts/publish.ts 
`

const CI_WORKFLOW = `name: CI

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches:
      - main
      - master

jobs:
  validate:
    name: Validate Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      # This will run deno fmt, deno check, and deno lint
      # If any of these fail, the workflow will fail and block PR merge
      - name: Validate code quality
        run: deno task pre-publish

      # This will test if the publication process would work without actually publishing
      # Helps catch issues in the publication pipeline before merging
      - name: Test publication process
        run: deno task publish --dry-run
`

/**
 * Options for setting up JSR publishing
 */
export interface SetupOptions {
  dryRun?: boolean
  addWorkflow?: boolean
  addCIWorkflow?: boolean
  silent?: boolean
}

/**
 * Simple function to strip comments from JSON files
 */
function stripJsonComments(jsonText: string): string {
  // Very basic implementation to strip comments
  return jsonText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Check if the current directory contains a deno config file
 * and return its path if found
 */
async function findDenoConfigFile(): Promise<string | null> {
  const possibleFiles = ['deno.json', 'deno.jsonc']

  for (const file of possibleFiles) {
    if (await exists(file)) {
      return file
    }
  }

  return null
}

/**
 * Add publish task to deno.json or deno.jsonc
 */
async function addTasks(
  configPath: string,
  silent = false,
): Promise<void> {
  // Read the config file
  let content = await Deno.readTextFile(configPath)

  // Parse the JSON
  let config
  try {
    config = JSON.parse(
      configPath.endsWith('.jsonc') ? stripJsonComments(content) : content,
    )
  } catch (error) {
    if (!silent) {
      log.error(`Error parsing ${configPath}: ${String(error)}`)
    }
    throw new Error(`Invalid JSON in ${configPath}`)
  }

  // Check if tasks section already exists
  if (!config.tasks) {
    // No tasks section, need to add it
    if (content.endsWith('}')) {
      // Remove the last closing brace
      content = content.substring(0, content.lastIndexOf('}'))
      // Add tasks section
      content +=
        ',\n  "tasks": {\n    "publish": "deno run -A jsr:@deno-kit/publish",\n    "publish:dry-run": "deno run -A jsr:@deno-kit/publish --dry-run"\n  }\n}'
    }
  } else if (!config.tasks.publish) {
    // Tasks section exists but no publish task
    // Find the tasks section in the JSON
    const tasksIndex = content.indexOf('"tasks"')
    const tasksOpenBrace = content.indexOf('{', tasksIndex)
    const tasksCloseBrace = findMatchingBrace(content, tasksOpenBrace)

    // Insert publish tasks before the closing brace of tasks
    content = content.substring(0, tasksCloseBrace) +
      (content[tasksCloseBrace - 1] !== '{' ? ',' : '') +
      '\n    "publish": "deno run -A jsr:@deno-kit/publish",\n    "publish:dry-run": "deno run -A jsr:@deno-kit/publish --dry-run"\n  ' +
      content.substring(tasksCloseBrace)
  }

  // Write the updated content back to the file
  await Deno.writeTextFile(configPath, content)

  if (!silent) {
    log.success(`Added 'publish' and 'publish:dry-run' tasks to ${configPath}`)
  }
}

/**
 * Install @deno-kit/publish package from JSR
 */
async function installPackage(silent = false): Promise<boolean> {
  if (!silent) {
    log.info('Installing @deno-kit/publish package from JSR...')
  }

  try {
    const cmd = new Deno.Command('deno', {
      args: ['add', '--force', 'jsr:@deno-kit/publish'],
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const status = await cmd.output()

    if (!status.success) {
      if (!silent) {
        log.error('Failed to install package')
      }
      return false
    }

    if (!silent) {
      log.success('Package installed successfully')
    }
    return true
  } catch (error) {
    if (!silent) {
      log.error(`Error installing package: ${String(error)}`)
    }
    return false
  }
}

/**
 * Helper function to find the matching closing brace
 */
function findMatchingBrace(text: string, openBraceIndex: number): number {
  let braceCount = 1
  for (let i = openBraceIndex + 1; i < text.length; i++) {
    if (text[i] === '{') {
      braceCount++
    } else if (text[i] === '}') {
      braceCount--
      if (braceCount === 0) {
        return i
      }
    }
  }
  return -1
}

/**
 * Add GitHub workflow file for automated releases
 */
async function addGitHubWorkflow(silent = false): Promise<boolean> {
  // Use path.join for cross-platform compatibility
  const githubDir = join('.github')
  const workflowDir = join(githubDir, 'workflows')
  const workflowPath = join(workflowDir, 'jsr-publish.yml')

  // Check if file already exists
  if (await exists(workflowPath)) {
    if (!silent) {
      log.error(`Workflow file already exists at ${workflowPath}`)
    }
    return false
  }

  // Create directories if they don't exist
  await ensureDir(workflowDir)

  // Write workflow file
  await Deno.writeTextFile(workflowPath, JSR_PUBLISH_WORKFLOW)

  if (!silent) {
    log.success(`GitHub Action workflow created at ${workflowPath}`)
  }
  return true
}

/**
 * Add GitHub CI workflow file
 */
async function addCIWorkflow(silent = false): Promise<boolean> {
  // Use path.join for cross-platform compatibility
  const githubDir = join('.github')
  const workflowDir = join(githubDir, 'workflows')
  const workflowPath = join(workflowDir, 'ci.yml')

  // Check if file already exists
  if (await exists(workflowPath)) {
    if (!silent) {
      log.error(`CI workflow file already exists at ${workflowPath}`)
    }
    return false
  }

  // Create directories if they don't exist
  await ensureDir(workflowDir)

  // Write workflow file
  await Deno.writeTextFile(workflowPath, CI_WORKFLOW)

  if (!silent) {
    log.success(`GitHub Action CI workflow created at ${workflowPath}`)
  }
  return true
}

/**
 * Run a dry run of the publish script
 */
async function runDryRun(silent = false): Promise<boolean> {
  if (!silent) {
    log.info('Running publication dry run...')
  }

  try {
    const cmd = new Deno.Command('deno', {
      args: ['run', '--allow-all', 'jsr:@deno-kit/publish', '--dry-run'],
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const { success } = await cmd.output()

    if (!silent) {
      if (success) {
        log.success('Dry run completed successfully!')
      } else {
        log.error('Dry run failed')
      }
    }

    return success
  } catch (error) {
    if (!silent) {
      log.error(`Error running dry run: ${String(error)}`)
    }
    return false
  }
}

/**
 * Setup JSR publishing for a Deno project
 */
export async function setupJSRPublish(
  options: SetupOptions = {},
): Promise<boolean> {
  const {
    dryRun = false,
    addWorkflow = false,
    addCIWorkflow: installCIWorkflow = false,
    silent = false,
  } = options

  if (!silent) {
    log.info('JSR Publication Setup')
  }

  // Check for deno config file
  const configPath = await findDenoConfigFile()
  if (!configPath) {
    if (!silent) {
      log.error('No deno.json or deno.jsonc found in the working directory')
    }
    return false
  }

  // Add publish task to config
  await addTasks(configPath, silent)

  // Install the package if not in dry run mode
  if (!dryRun && !(await installPackage(silent))) {
    return false
  }

  // Run a dry run if requested
  if (dryRun) {
    await runDryRun(silent)
  }

  // Add workflow file if requested
  if (addWorkflow) {
    await addGitHubWorkflow(silent)
  }

  // Add CI workflow if requested
  if (installCIWorkflow) {
    await addCIWorkflow(silent)
  }

  if (!silent) {
    log.success(
      "Installation complete! You can now use 'deno task publish' to publish your package to JSR.",
    )
  }

  return true
}

/**
 * Main function for CLI usage
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const args = parseArgs(Deno.args, {
    boolean: ['help', 'dry-run'],
    alias: { h: 'help', d: 'dry-run' },
  })

  // Show help if requested
  if (args.help) {
    console.log(`
JSR Publication Setup

This script sets up automatic publishing to JSR registry.

Usage:
  deno run --allow-all ./scripts/publish-install.ts [options]

Options:
  -h, --help      Show this help message
  -d, --dry-run   Automatically run a dry-run after installation
  `)
    Deno.exit(0)
  }

  // Check for deno config file
  const configPath = await findDenoConfigFile()
  if (!configPath) {
    log.error('No deno.json or deno.jsonc found in the working directory')
    Deno.exit(1)
  }

  // Install package
  await installPackage()

  // Add tasks to config
  await addTasks(configPath)

  // Setup completed successfully
  log.success('Setup completed successfully!')

  // Ask if user wants to run a dry run (or use command line flag)
  let runTestNow = !!args['dry-run']

  if (!runTestNow) {
    const response = await promptSelect(
      "Would you like to test publication with a dry run? (This won't modify files or publish to JSR)",
      ['No', 'Yes'],
    )
    runTestNow = response === 'Yes'
  }

  if (runTestNow) {
    const result = await runDryRun()

    if (!result) {
      log.warning(
        'Dry run encountered issues. You may still be able to publish, but should check for potential problems.',
      )
    }
  }

  // Ask if user wants to add GitHub Action
  const response = await promptSelect(
    'Would you like to add the GitHub Action workflow for automated publishing?',
    ['No', 'Yes'],
  )
  const shouldAddWorkflow = response === 'Yes'

  if (shouldAddWorkflow) {
    await addGitHubWorkflow()
  }

  // Ask if user wants to add CI workflow
  const ciResponse = await promptSelect(
    'Would you like to add the CI workflow for code quality checks and publishing dry-runs on pull requests?' +
      (shouldAddWorkflow
        ? ' (Recommended when using the JSR publish workflow)'
        : ''),
    ['No', 'Yes'],
  )
  const shouldAddCIWorkflow = ciResponse === 'Yes'

  if (shouldAddCIWorkflow) {
    await addCIWorkflow()
  }

  log.success(
    "Installation complete! You can now use 'deno task publish' to publish your package to JSR.",
  )
}

// Run the script if called directly, not when imported
if (import.meta.main) {
  try {
    await main()
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Error: ${errorMessage}`)
    Deno.exit(1)
  }
}

export {
  addCIWorkflow,
  addGitHubWorkflow,
  addTasks,
  findDenoConfigFile,
  installPackage,
  runDryRun,
}
