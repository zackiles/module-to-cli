#!/usr/bin/env -S deno run --allow-all

/**
 * @module spec
 * @description Command-line tool for generating module specifications from TypeScript files.
 * This module handles command-line argument parsing and specification generation for the module-to-cli tool.
 */

import { parseArgs } from '@std/cli/parse-args'
import { ModuleToCLI } from './parse.ts'
import {
  printMenuForSpecificationGenerator,
  printModuleInfo,
  printModuleMethods,
  printSimpleMethodInfo,
  printSimpleModuleInfo,
} from './print.ts'

/**
 * Configuration options for module processing
 */
interface ModuleProcessingConfig {
  /** Path to the file to process */
  filePath: string
  /** Output as JSON format */
  outputJson: boolean
  /** Use simplified output format with less type details */
  useSimpleFormat: boolean
}

interface CommandLineResult {
  /** The module processing configuration, or null if not available */
  config: ModuleProcessingConfig | null
  /** The exit code to use if configuration is null */
  exitCode: number
  /** Whether help was displayed */
  helpDisplayed: boolean
}

function parseCommandLineArgs(): CommandLineResult {
  // Check if the first argument is "generate" and remove it
  const args = [...Deno.args]
  if (args.length > 0 && args[0] === 'generate') {
    args.shift()
  }

  const flags = parseArgs(args, {
    boolean: ['help', 'json', 'simple'],
    alias: { h: 'help', j: 'json', s: 'simple' },
    default: {},
    unknown: (arg) => {
      if (arg.startsWith('-')) {
        console.warn(`Warning: Unknown option ${arg}`)
      }
      return true
    },
  })

  if (flags.help) {
    printMenuForSpecificationGenerator()
    return { config: null, exitCode: 0, helpDisplayed: true }
  }

  // Check for file path
  if (flags._.length === 0) {
    console.error('Error: Missing path to module')
    printMenuForSpecificationGenerator()
    return { config: null, exitCode: 1, helpDisplayed: true }
  }

  return {
    config: {
      filePath: String(flags._[0]),
      outputJson: flags.json,
      useSimpleFormat: flags.simple,
    },
    exitCode: 0,
    helpDisplayed: false,
  }
}

async function generateModuleSpecification(
  config: ModuleProcessingConfig,
): Promise<void> {
  try {
    const moduleToCLI = new ModuleToCLI(config.filePath, {})
    const result = await moduleToCLI.get()

    if (config.outputJson) {
      // Format JSON output based on simplified preference
      const output = config.useSimpleFormat
        ? {
          methods: printSimpleMethodInfo(result.methods),
          module: printSimpleModuleInfo(result.module),
        }
        : result

      console.log(JSON.stringify(output, null, 2))
      Deno.exit(0)
    }

    // Display formatted information
    printModuleInfo(result.module, config.useSimpleFormat)
    console.log('')
    printModuleMethods(result.methods, config.useSimpleFormat)
  } catch (error) {
    const errorMessage = error instanceof Error
      ? `${error.message}\n${error.stack}`
      : `Unknown error: ${String(error)}`

    console.error(errorMessage)
    throw error
  }
}

async function main(): Promise<void> {
  try {
    const result = parseCommandLineArgs()
    if (!result.config) {
      Deno.exit(result.exitCode)
    }

    await generateModuleSpecification(result.config)
  } catch {
    Deno.exit(1)
  }
}

if (import.meta.main) {
  main()
}

export { generateModuleSpecification, main, parseCommandLineArgs }
export type { CommandLineResult, ModuleProcessingConfig }
