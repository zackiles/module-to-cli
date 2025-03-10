/**
 * Tests for the golden mocks functionality.
 *
 * These tests verify:
 * 1. Golden mocks (JSON and text) can be generated
 * 2. The generated mocks match the output from the library/CLI
 */

import { assertEquals, assertExists } from '@std/assert'
import { join } from '@std/path'
import { ModuleToCLI } from '../src/parse.ts'
import {
  createSnapshots,
  getSnapshot,
  type MockScenario,
} from './test-utils/snapshot.ts'
import { testSetup } from './test-utils/test-config.ts'

testSetup()

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path)
    return true
  } catch {
    return false
  }
}

function assertTrue(condition: boolean, message: string): void {
  assertEquals(condition, true, message)
}

// Setup and cleanup for each test
Deno.test({
  name: 'Golden mocks can be generated and retrieved',
  async fn() {
    // Create a temporary directory for mocks
    const tempMocksDir = await Deno.makeTempDir({
      prefix: 'golden-mocks-temp-',
    })
    console.debug(`Created temporary directory: ${tempMocksDir}`)

    try {
      // Create a sample TypeScript file for testing
      const sampleFilePath = join(tempMocksDir, 'sample.ts')
      const sampleTsContent = `
/**
 * A simple sample TypeScript module for testing golden mocks
*/

/**
 * Adds two numbers
 * @param a First number
 * @param b Second number
 * @returns Sum of the two numbers
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts one number from another
 * @param a Minuend
 * @param b Subtrahend
 * @returns Difference of the two numbers
 */
export function subtract(a: number, b: number): number {
  return a - b;
}
`
      // Write the sample TS file to the temp directory
      await Deno.writeTextFile(sampleFilePath, sampleTsContent)
      console.debug(`Created sample TypeScript file: ${sampleFilePath}`)

      // Generate mocks
      await createSnapshots(tempMocksDir)

      // Check that the JSON file was created
      const jsonMockPath = join(tempMocksDir, 'sample.golden.jsonc')
      const jsonExists = await fileExists(jsonMockPath)
      assertTrue(jsonExists, 'JSON mock file should exist')

      // Check that the text file was created
      const txtMockPath = join(tempMocksDir, 'sample.golden.txt')
      const txtExists = await fileExists(txtMockPath)
      assertTrue(txtExists, 'Text mock file should exist')

      // Debug: Output file content
      console.debug(
        'JSON content length:',
        (await Deno.readTextFile(jsonMockPath)).length,
      )
      console.debug(
        'Text content length:',
        (await Deno.readTextFile(txtMockPath)).length,
      )

      // Get the mocks via the get function
      const mockScenarios: MockScenario[] = await getSnapshot(tempMocksDir)

      // Verify that we got a scenario
      assertEquals(mockScenarios.length, 1, 'Should return 1 mock scenario')

      const scenario = mockScenarios[0]

      // Verify scenario properties
      assertEquals(
        scenario.moduleName,
        'sample',
        'Module name should be "sample"',
      )
      assertTrue(
        scenario.modulePath.endsWith('sample.ts'),
        'Module path should end with sample.ts',
      )

      // Verify that the json property contains the expected methods
      assertExists(
        scenario.json.methods.add,
        'JSON should contain "add" method',
      )
      assertExists(
        scenario.json.methods.subtract,
        'JSON should contain "subtract" method',
      )
      console.log(scenario.json)
      // Verify the descriptions match

      assertEquals(
        scenario.json.methods.add.description,
        'A simple sample TypeScript module for testing golden mocks',
        'Method description should match',
      )
      assertEquals(
        scenario.json.methods.subtract.description,
        'Subtracts one number from another',
        'Method description should match',
      )

      // Verify the text content contains references to the functions
      assertTrue(
        scenario.text.includes('add'),
        'Text should contain "add" function',
      )
      assertTrue(
        scenario.text.includes('subtract'),
        'Text should contain "subtract" function',
      )

      // Compare with direct output from the library
      const moduleToCLI = new ModuleToCLI(sampleFilePath)
      const directOutput = await moduleToCLI.get()

      // Compare the structure and content of the JSON data
      assertEquals(
        Object.keys(directOutput.methods).sort(),
        Object.keys(scenario.json.methods).sort(),
        'Direct output and mock JSON should have the same method keys',
      )

      // Deeper validation for the add method
      assertEquals(
        directOutput.methods.add.description,
        scenario.json.methods.add.description,
        'Method descriptions should match',
      )

      // Check parameters if they exist in the structure
      if (
        directOutput.methods.add.params && scenario.json.methods.add.params
      ) {
        assertEquals(
          directOutput.methods.add.params.length,
          scenario.json.methods.add.params.length,
          'Parameter counts should match',
        )
      }
    } finally {
      // Cleanup
      try {
        await Deno.remove(tempMocksDir, { recursive: true })
        console.debug(`Cleaned up temporary directory: ${tempMocksDir}`)
      } catch (error) {
        console.error(`Error cleaning up temporary directory: ${error}`)
      }
    }
  },
})
