#!/usr/bin/env deno run --allow-read --allow-write --allow-run

import { basename, extname, join } from '@std/path'
import { parse as JSONCParse } from '@std/jsonc'
import { ModuleToCLI } from '../../src/parse.ts'
import { MockScenario, ParsedModuleResult } from '../../src/types.ts'
import { testSetup } from './test-config.ts'

testSetup()

const generateTextSpecFromCLI = (modulePath: string) => new Deno.Command(Deno.execPath(), {
  args: [
    'run',
    '--allow-all',
    Deno.env.get('CLI_PATH')!,
    'generate',
    modulePath,
  ],
  stdout: 'piped',
  stderr: 'piped',
})

/**
 * Creates golden mocks for testing the module-to-cli functionality.
 * This script:
 * 1. Takes module files from the test/mocks directory
 * 2. Processes them with the ModuleToCLI parser
 * 3. Creates golden JSON and text mocks to compare against in tests
 */

const MOCKS_DIR = join(Deno.cwd(), 'test', 'mocks')
const DEFAULT_COMMAND = createSnapshots.name

// Creates a text and JSON golden mock for a single Typescript file
async function createMocksForModule(
  modulePath: string,
  mocksDir = MOCKS_DIR,
): Promise<void> {
  console.log(`Processing file: ${modulePath}`)

  // Build file paths and create header
  const moduleName = basename(modulePath)
  const moduleNameNoExtension = moduleName.slice(0, -extname(moduleName).length)
  const goldenMockPaths = {
    json: join(mocksDir, `${moduleNameNoExtension}.golden.jsonc`),
    text: join(mocksDir, `${moduleNameNoExtension}.golden.txt`),
  }

  const jsonFileHeaderComment = (name: string) => `
// ${name} was auto-generated for testing purposes. Do NOT edit it!
// It represents a golden response from the AST parser for the associated file with the same name (different extension).
//
// You can re-generate it by running:
//   'deno task golden-mocks'
`

  // Generate AST info using ModuleToCLI as a library and write .golden.jsonc file
  await Deno.writeTextFile(
    goldenMockPaths.json,
    jsonFileHeaderComment(moduleName) +
      JSON.stringify(await new ModuleToCLI(modulePath).get(), null, 2).trim(),
  )
  console.info(`Created JSONC file: ${goldenMockPaths.json}`)

  // We use the ModuleToCLI to get the text output from it's stdout to test against the golden text mock
  // This can cause issues with even slight variations of the stdout output string. NOTE: the golden text
  // mock is NOT JSON. It's a human/readable formatted output
  const cliOutput = await (async () => {
    const resolvedPath = await Deno.realPath(modulePath)
    const { stdout, stderr } = await generateTextSpecFromCLI(resolvedPath).output()

    return {
      text: new TextDecoder().decode(stdout),
      error: new TextDecoder().decode(stderr),
    }
  })()

  // Handle output messages
  cliOutput.error && console.error(`CLI Error: ${cliOutput.error}`)

  !cliOutput.text && console.warn(
    cliOutput.error
      ? `Warning: No stdout output from ModuleToCLI CLI, but stderr was present. The .golden.txt file may be empty.`
      : `Warning: ModuleToCLI CLI produced no output for ${modulePath}. The .golden.txt file may be empty.`,
  )

  // Write text output
  await Deno.writeTextFile(goldenMockPaths.text, cliOutput.text)
  console.info('Text mock written!', {
    txtOutputPath: goldenMockPaths.text,
    textOutput: cliOutput.text.trim(),
  })
}

async function createSnapshots(mocksDir = MOCKS_DIR) {
  await Deno.stat(mocksDir)
  console.log(`Generating golden mocks in ${mocksDir}`)

  // Collect all files from the directory
  const files = new Map<string, { ts?: string; txt?: string; jsonc?: string }>()

  for await (const entry of Deno.readDir(mocksDir)) {
    if (!entry.isFile) continue

    const filePath = join(mocksDir, entry.name)

    // Match only .ts files or files with .golden.txt or .golden.jsonc extensions
    // This ensures we don't process regular .txt or .jsonc files without the .golden part
    const match = entry.name.match(/^(.+?)(?:\.golden\.(txt|jsonc)|\.ts)$/)

    if (!match) continue

    const [, baseName, type] = match

    if (!files.has(baseName)) {
      files.set(baseName, {})
    }

    const fileInfo = files.get(baseName)!

    if (entry.name.endsWith('.ts')) {
      fileInfo.ts = filePath
    } else if (type === 'txt') {
      fileInfo.txt = filePath
    } else if (type === 'jsonc') {
      fileInfo.jsonc = filePath
    }
  }

  // Process TypeScript files and remove orphaned golden files
  let processedCount = 0
  let orphanedCount = 0

  for (const [baseName, fileInfo] of files.entries()) {
    if (fileInfo.ts) {
      await createMocksForModule(fileInfo.ts, mocksDir)
      processedCount++
    } else {
      // Remove orphaned golden files
      if (fileInfo.txt) {
        await Deno.remove(fileInfo.txt)
        console.log(`Removed orphaned golden file: ${fileInfo.txt}`)
        orphanedCount++
      }
      if (fileInfo.jsonc) {
        await Deno.remove(fileInfo.jsonc)
        console.log(`Removed orphaned golden file: ${fileInfo.jsonc}`)
        orphanedCount++
      }
    }
  }

  if (processedCount === 0) {
    console.log('No TypeScript files found in the mocks directory.')
  } else {
    console.log(`Processed ${processedCount} TypeScript files successfully.`)
  }

  if (orphanedCount > 0) {
    console.log(`Removed ${orphanedCount} orphaned golden files.`)
  }
}

/**
 * Gets all mock scenarios from the mocks directory
 * @param mocksDir Directory containing mock files
 * @returns Array of mock scenarios
 */
async function getSnapshot(mocksDir = MOCKS_DIR): Promise<Array<MockScenario>> {
  const scenarios: Array<MockScenario> = []

  // Get all TypeScript files in the mocks directory
  for await (const entry of Deno.readDir(mocksDir)) {
    if (!entry.isFile || !entry.name.endsWith('.ts')) continue

    try {
      const modulePath = join(mocksDir, entry.name)
      const moduleName = entry.name.slice(0, -extname(entry.name).length)

      // Get the paths to the golden files
      const goldenJsonPath = join(mocksDir, `${moduleName}.golden.jsonc`)
      const goldenTextPath = join(mocksDir, `${moduleName}.golden.txt`)

      // Read the golden files
      const jsonContent = await Deno.readTextFile(goldenJsonPath)
      const textContent = await Deno.readTextFile(goldenTextPath)

      // Parse the JSON content and ensure proper type casting
      const jsonValue = JSONCParse(jsonContent)
      const json = jsonValue as unknown as ParsedModuleResult

      // Create the mock scenario
      scenarios.push({
        moduleName,
        modulePath,
        moduleInstance: null,
        moduleInstanceString: '',
        json,
        text: textContent,
      })
    } catch (error) {
      // Silently skip any modules that fail to load or parse
      console.log(
        `Skipping scenario due to initialization constraints: ${entry.name}`,
      )
      continue
    }
  }

  return scenarios
}

if (import.meta.main) {
  const args = Deno.args

  // Filter out the "--" if it's present (happens when using deno task with arguments)
  const filteredArgs = args.filter((arg) => arg !== '--')

  const functionName = filteredArgs[0] || DEFAULT_COMMAND
  const commandArg = filteredArgs[1]

  // deno-lint-ignore ban-types
  const availableFunctions: Record<string, Function> = {
    createSnapshots,
    getSnapshot,
  }

  // Check if the requested function exists
  if (!availableFunctions[functionName]) {
    console.error(`Error: Function "${functionName}" not found`)
    Deno.exit(1)
  }

  ;(async () => {
    try {
      let result
      if (commandArg) {
        result = await availableFunctions[functionName](commandArg)
      } else {
        result = await availableFunctions[functionName]()
      }

      if (result) {
        console.log(JSON.stringify(result, null, 2))
      }
    } catch (error) {
      console.error(`Error executing ${functionName}:`, error)
      Deno.exit(1)
    }
  })()
}

export { createSnapshots, getSnapshot }

export type { MockScenario }
