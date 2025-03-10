/**
 * @module publish-utils
 * @description Shared utilities for the publishing process
 */

import { log } from './publish-log.ts'
import { BumpType } from './publish-types.ts'

/**
 * Safely extract error message from any error type
 * @param error The error object or unknown value
 * @returns A string representation of the error
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Check if a file exists at the given path
 * @param path Path to check
 * @returns Promise that resolves to true if file exists, false otherwise
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Read a text file with error handling
 * @param path File path to read
 * @returns File content as string or null if file doesn't exist
 */
async function readTextFile(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path)
  } catch (error) {
    log.debug(`Error reading file ${path}: ${getErrorMessage(error)}`)
    return null
  }
}

/**
 * Write text to a file with error handling
 * @param path File path to write to
 * @param content Content to write
 * @param dryRun If true, don't actually write, just log
 * @returns Promise that resolves to true if successful, false otherwise
 */
async function writeTextFile(
  path: string,
  content: string,
  dryRun = false,
): Promise<boolean> {
  try {
    if (!dryRun) {
      await Deno.writeTextFile(path, content)
    } else {
      log.info(`[DRY RUN] Would write to ${path}`)
    }
    return true
  } catch (error) {
    log.error(`Error writing to file ${path}: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Run a shell command and return success status
 * @param cmd Command to run
 * @param args Command arguments
 * @param dryRun If true, don't actually run, just log
 * @returns Promise that resolves to true if command succeeded, false otherwise
 */
async function runCommand(
  cmd: string,
  args: string[],
  dryRun = false,
): Promise<boolean> {
  const cmdString = `${cmd} ${args.join(' ')}`

  if (dryRun) {
    log.info(`[DRY RUN] Would execute: ${cmdString}`)
    return true
  }

  log.debug(`Executing: ${cmdString}`)

  try {
    const process = new Deno.Command(cmd, {
      args,
      stdout: 'piped',
      stderr: 'piped',
    })

    const { code, stdout, stderr } = await process.output()

    if (code === 0) {
      const output = new TextDecoder().decode(stdout).trim()
      if (output) {
        log.debug(`Command output: ${output}`)
      }
      return true
    } else {
      const errorOutput = new TextDecoder().decode(stderr).trim()
      log.error(`Command failed: ${cmdString}\nOutput: ${errorOutput}`)
      return false
    }
  } catch (error) {
    log.error(`Failed to execute ${cmdString}: ${getErrorMessage(error)}`)
    return false
  }
}

/**
 * Parse a semantic version string and increment according to bump type
 * @param version Current version string (e.g. "1.2.3")
 * @param bumpType Type of version bump (major, minor, patch)
 * @returns New version string
 */
function incrementVersion(
  version: string,
  bumpType: BumpType,
): string {
  if (!bumpType) return version

  const parts = version.replace(/^v/, '').split('.')
  const [major, minor, patch] = parts.map(Number)

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      return version
  }
}

export {
  fileExists,
  getErrorMessage,
  incrementVersion,
  readTextFile,
  runCommand,
  writeTextFile,
}
