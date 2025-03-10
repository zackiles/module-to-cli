/**
 * @module publish-config
 * @description Configuration file handling for the publishing process
 */

import { parse as parseJsonc } from '@std/jsonc'
import { log } from './publish-log.ts'
import {
  getErrorMessage,
  readTextFile,
  writeTextFile,
} from './publish-utils.ts'
import { ConfigFile, JsonObject } from './publish-types.ts'

// Config files to check in priority order
const CONFIG_FILES = ['jsr.json', 'deno.json', 'deno.jsonc']

/**
 * Find and read the first available config file from the priority list
 * @param configFiles List of config files to check, in priority order
 * @returns The config file contents and path, or null if not found
 */
const findConfigFile = async (
  configFiles = CONFIG_FILES,
): Promise<ConfigFile> => {
  for (const path of configFiles) {
    const fileData = await readTextFile(path)
    if (fileData !== null) {
      return { path, data: fileData }
    }
  }
  return null
}

/**
 * Parse a configuration file based on its format
 * @param filePath Path to the configuration file
 * @param fileData Contents of the configuration file
 * @returns Parsed JSON object
 */
const parseConfig = (filePath: string, fileData: string): JsonObject => {
  try {
    if (filePath.endsWith('.jsonc')) {
      return parseJsonc(fileData) as JsonObject
    } else {
      return JSON.parse(fileData) as JsonObject
    }
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    log.error(`Error parsing ${filePath}: ${errorMessage}`)
    throw new Error(`Failed to parse ${filePath}: ${errorMessage}`)
  }
}

/**
 * Update the version in the config file
 * @param version New version to set
 * @param dryRun Don't actually write changes, just report
 * @returns The updated version number
 */
const updateVersion = async (
  version: string,
  dryRun = false,
): Promise<string> => {
  const config = await findConfigFile()
  if (!config) {
    throw new Error('No config file found')
  }

  const versionPattern = /"version"\s*:\s*"[^"]*"/
  const versionReplacement = `"version": "${version}"`
  const updatedConfig = config.data.replace(versionPattern, versionReplacement)

  await writeTextFile(config.path, updatedConfig, dryRun)

  if (!dryRun) {
    log.info(`Updated version in ${config.path} to ${version}`)
  } else {
    log.info(`[DRY RUN] Would update version in ${config.path} to ${version}`)
  }

  return config.path
}

// Export the functions and constants
export { CONFIG_FILES, findConfigFile, parseConfig, updateVersion }
