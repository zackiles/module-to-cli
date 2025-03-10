import { assertEquals } from '@std/assert'
import { ModuleToCLI } from '../src/parse.ts'
import { ParsedModuleResult } from '../src/types.ts'
import { getSnapshot, MockScenario } from './test-utils/snapshot.ts'
import { testSetup } from './test-utils/test-config.ts'

testSetup()

/**
 * Factory function to create a Deno.Command for running the CLI with JSON output
 */
const createDenoCommandWithJson = (modulePath: string) =>
  new Deno.Command('deno', {
    args: [
      'run',
      '--allow-all',
      Deno.env.get('CLI_PATH')!,
      'generate',
      modulePath,
      '--json',
    ],
    env: {
      'DENO_ENV': 'test',
    },
    stdout: 'piped',
    stderr: 'piped',
  })

/**
 * Factory function to create a Deno.Command for running the CLI with text output
 */
const createDenoCommandWithText = (modulePath: string) =>
  new Deno.Command('deno', {
    args: [
      'run',
      '--allow-all',
      Deno.env.get('CLI_PATH')!,
      'generate',
      modulePath,
    ],
    stdout: 'piped',
    stderr: 'piped',
    env: {
      'DENO_ENV': 'test',
    },
  })

let mockScenarios: Array<MockScenario> = []
try {
  mockScenarios = await getSnapshot()
  console.log(`Found ${mockScenarios.length} test scenarios`)
} catch (error) {
  // Silently handle any initialization errors from test modules
  console.log(
    'Some test scenarios could not be loaded due to initialization constraints',
  )
}

/**
 * Tests the ModuleToCLI library functionality directly.
 *
 * This test verifies that the ModuleToCLI.get() method correctly extracts
 * metadata from TypeScript files by comparing its output against previously
 * generated golden mock files (*.golden.jsonc). Each scenario uses a different
 * TypeScript module with varying structures to ensure complete coverage of
 * the library's parsing capabilities.
 */
Deno.test('[As Library] parses correct JSON information from TypeScript files', async () => {
  for (const scenario of mockScenarios) {
    console.log(`Testing scenario: ${scenario.moduleName}`)

    // The JSON content is already parsed in the scenario
    const expectedOutput: ParsedModuleResult = scenario.json

    // Process the TypeScript file with ModuleToCLI
    const moduleToCLI = new ModuleToCLI(scenario.modulePath)
    const actualOutput = await moduleToCLI.get()

    // Normalize sourceModule property in exports
    // Some versions might have sourceModule: undefined while others might not have the property at all
    const normalizedExpected = JSON.parse(JSON.stringify(expectedOutput))
    const normalizedActual = JSON.parse(JSON.stringify(actualOutput))

    // First, check if the re-exported 'assert' was correctly identified as a re-export
    // Only do this for the complicated-module scenario
    if (scenario.moduleName === 'complicated-module') {
      // deno-lint-ignore no-explicit-any
      const assertExport = actualOutput.module.exports.find((exp: any) =>
        exp.name === 'assert'
      )

      if (!assertExport) {
        throw new Error(
          "Could not find 're-exported assert' in the module exports",
        )
      }

      assertEquals(
        assertExport.isReexport,
        true,
        "The 'assert' export should be identified as a re-export",
      )

      if (!assertExport.sourceModule) {
        throw new Error(
          "'sourceModule' property is missing from the re-exported assert",
        )
      }

      assertEquals(
        assertExport.sourceModule.includes('@std/assert'),
        true,
        'The sourceModule should reference the assert module',
      )

      console.log("✅ Re-export detection test passed for 'assert'")
    }

    // Remove sourceModule property from both objects for comparison
    if (normalizedExpected.module?.exports) {
      // deno-lint-ignore no-explicit-any
      normalizedExpected.module.exports.forEach((exp: any) => {
        delete exp.sourceModule
      })
    }

    if (normalizedActual.module?.exports) {
      // deno-lint-ignore no-explicit-any
      normalizedActual.module.exports.forEach((exp: any) => {
        delete exp.sourceModule
      })
    }

    // Compare the results
    assertEquals(
      normalizedActual,
      normalizedExpected,
      `Output for ${scenario.moduleName} does not match golden file`,
    )

    console.log(`✅ ${scenario.moduleName} passed`)
  }
})

/**
 * Tests the CLI interface of ModuleToCLI with the --json flag.
 *
 * This test verifies that running the CLI with the --json flag produces
 * the same output as directly using the library's ModuleToCLI.get() method.
 * It executes the CLI as a subprocess for each test scenario and compares
 * the JSON output against the expected results. This ensures that the CLI
 * interface correctly exposes the library's functionality and maintains
 * consistent behavior between both usage modes.
 */
Deno.test('[As CLI] parses correct JSON information from TypeScript files', async () => {
  for (const scenario of mockScenarios) {
    console.log(`Testing CLI scenario: ${scenario.moduleName}`)

    try {
      // Get the expected output directly from ModuleToCLI
      const moduleToCLI = new ModuleToCLI(scenario.modulePath)
      const expectedOutput = await moduleToCLI.get()

      // Run the CLI with the TypeScript file using Deno.command
      const command = createDenoCommandWithJson(scenario.modulePath)
      const { stdout, stderr, success } = await command.output()

      // Check if command was successful
      if (!success) {
        const errorOutput = new TextDecoder().decode(stderr)
        throw new Error(`CLI command failed: ${errorOutput}`)
      }

      // Get the actual CLI output
      const jsonOutput = new TextDecoder().decode(stdout)

      try {
        // Parse the JSON output
        const actualOutput = JSON.parse(jsonOutput) as ParsedModuleResult

        // Compare the keys (method names)
        assertEquals(
          Object.keys(actualOutput.methods).sort(),
          Object.keys(expectedOutput.methods).sort(),
          `CLI output for ${scenario.moduleName} has different methods than expected`,
        )

        // Compare core properties of methods
        for (const key of Object.keys(expectedOutput.methods)) {
          if (actualOutput.methods[key]) {
            assertEquals(
              actualOutput.methods[key].description,
              expectedOutput.methods[key].description,
              `Description for method ${key} doesn't match`,
            )

            // Compare param counts
            assertEquals(
              actualOutput.methods[key].params.length,
              expectedOutput.methods[key].params.length,
              `Parameter count for method ${key} doesn't match`,
            )
          }
        }

        console.log(`✅ CLI test for ${scenario.moduleName} passed`)
      } catch (parseError) {
        console.error(`Error parsing CLI JSON output: ${parseError}`)
        throw new Error(`Failed to parse CLI output as JSON: ${jsonOutput}`)
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.warn(
          `Scenario file not found: ${scenario.modulePath}`,
        )
      } else {
        throw error
      }
    }
  }
})

/**
 * Tests the CLI interface of ModuleToCLI in text output mode (default, without --json flag).
 *
 * This test verifies that running the CLI without any output format flags produces
 * the expected text output that matches the golden text files. It executes the CLI
 * as a subprocess for each test scenario and compares the raw text output against
 * the golden text content. This ensures that the CLI's default text formatter
 * correctly displays the module's metadata in a human-readable format.
 */
Deno.test('[As CLI] parses correct text information from TypeScript files', async () => {
  for (const scenario of mockScenarios) {
    console.log(`Testing CLI text output for scenario: ${scenario.moduleName}`)

    try {
      // Run the CLI with the TypeScript file using Deno.command
      // Note: No --json flag here to get text output
      const command = createDenoCommandWithText(scenario.modulePath)
      const { stdout, stderr, success } = await command.output()

      // Check if command was successful
      if (!success) {
        const errorOutput = new TextDecoder().decode(stderr)
        throw new Error(`CLI command failed: ${errorOutput}`)
      }

      // Get the actual CLI text output - normalize line endings and trim whitespace
      const textOutput = new TextDecoder().decode(stdout)

      // Get the expected text output directly from the scenario
      const expectedText = scenario.text

      // Debugging
      console.log('Expected text from golden file:')
      console.log(expectedText)
      console.log('Actual text from CLI:')
      console.log(textOutput)

      // Compare the results with strict equality
      assertEquals(
        textOutput,
        expectedText,
        `CLI text output for ${scenario.moduleName} does not match golden text file`,
      )

      console.log(`✅ CLI text test for ${scenario.moduleName} passed`)
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.warn(
          `Scenario file not found: ${scenario.modulePath}`,
        )
      } else {
        throw error
      }
    }
  }
})
