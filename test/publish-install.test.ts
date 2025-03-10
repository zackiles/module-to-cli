/**
 * @module publish-install.test
 * @description Tests for the publish-install module functionality.
 */

import { assertEquals, assertExists, assertStringIncludes } from '@std/assert'
import { exists } from '@std/fs'
import { join } from '@std/path'
import {
  addCIWorkflow,
  findDenoConfigFile,
  setupJSRPublish,
} from '../scripts/publish-install.ts'

// Helper assertion function
function assertTrue(condition: boolean, message: string): void {
  assertEquals(condition, true, message)
}

// Mock objects to track function calls and avoid actual system changes
let originalConsoleLog: typeof console.log
let originalDenoExit: typeof Deno.exit
let originalConfirm: typeof globalThis.confirm
let originalDenoCommand: typeof Deno.Command
let testDir: string
let originalCwd: string
let logs: string[] = []

// Helper to create a temporary test directory
async function createTestDirectory(): Promise<string> {
  const testDir = await Deno.makeTempDir({ prefix: 'jsr-publish-test-' })
  return testDir
}

// Create a basic deno.json file for testing
async function createMockDenoConfig(dir: string): Promise<string> {
  const configPath = join(dir, 'deno.json')
  await Deno.writeTextFile(
    configPath,
    `{
  "name": "test-package",
  "version": "1.0.0"
}`,
  )
  return configPath
}

// Setup test environment
async function setupTest(): Promise<void> {
  // Save original working directory
  originalCwd = Deno.cwd()

  // Create test directory and move into it
  testDir = await createTestDirectory()
  Deno.chdir(testDir)

  // Save original functions
  originalConsoleLog = console.log
  originalDenoExit = Deno.exit
  originalConfirm = globalThis.confirm
  originalDenoCommand = Deno.Command

  // Mock console.log
  logs = []
  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '))
  }

  // Mock Deno.exit
  Deno.exit = (code?: number) => {
    throw new Error(`Deno.exit called with code: ${code}`)
  }

  // Mock confirm dialog to always return true
  globalThis.confirm = (_message?: string) => true

  // Mock Deno.Command to prevent actual command execution
  Deno.Command = class MockCommand {
    constructor(public command: string, public options: Deno.CommandOptions) {}

    output(): Promise<Deno.CommandOutput> {
      return Promise.resolve({
        code: 0,
        success: true,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        signal: null,
      })
    }

    spawn(): Deno.ChildProcess {
      throw new Error('Not implemented in test')
    }
  } as unknown as typeof Deno.Command

  // Create a mock deno.json file
  await createMockDenoConfig(testDir)
}

// Clean up after test
function cleanupTest(): void {
  // Restore original working directory
  Deno.chdir(originalCwd)

  // Restore original functions
  console.log = originalConsoleLog
  Deno.exit = originalDenoExit
  globalThis.confirm = originalConfirm
  Deno.Command = originalDenoCommand

  // Clean up test directory
  try {
    Deno.removeSync(testDir, { recursive: true })
  } catch (e) {
    console.error('Failed to clean up test directory:', e)
  }
}

// Start of actual tests
Deno.test('findDenoConfigFile should find deno.json in the current directory', async () => {
  await setupTest()

  try {
    const configPath = await findDenoConfigFile()
    assertExists(configPath, 'Should find deno.json')
    assertEquals(configPath, 'deno.json', 'Should return correct file name')
  } finally {
    cleanupTest()
  }
})

Deno.test('setupJSRPublish should work with default options', async () => {
  await setupTest()

  try {
    const result = await setupJSRPublish({ silent: true })
    assertEquals(result, true, 'Setup should succeed')

    // Check if tasks were added to deno.json
    const configContent = await Deno.readTextFile('deno.json')
    assertTrue(configContent.includes('"publish":'), 'Should add publish task')
  } finally {
    cleanupTest()
  }
})

Deno.test('setupJSRPublish should work with custom options', async () => {
  await setupTest()

  try {
    const result = await setupJSRPublish({
      dryRun: true,
      addWorkflow: true,
      addCIWorkflow: true,
      silent: false,
    })

    assertEquals(result, true, 'Setup should succeed')

    // Check if GitHub workflow was created
    const publishWorkflowExists = await exists(
      '.github/workflows/jsr-publish.yml',
    )
    assertEquals(
      publishWorkflowExists,
      true,
      'Should create GitHub workflow file',
    )

    // Check if CI workflow was created
    const ciWorkflowExists = await exists('.github/workflows/ci.yml')
    assertEquals(ciWorkflowExists, true, 'Should create CI workflow file')

    // Verify logs were output (not silent)
    assertTrue(logs.length > 0, 'Should output logs when not silent')
  } finally {
    cleanupTest()
  }
})

Deno.test('addCIWorkflow should create CI workflow file', async () => {
  await setupTest()

  try {
    const result = await addCIWorkflow(true)
    assertEquals(result, true, 'Should successfully create CI workflow')

    // Check if CI workflow file was created
    const ciWorkflowExists = await exists('.github/workflows/ci.yml')
    assertEquals(ciWorkflowExists, true, 'Should create CI workflow file')

    // Verify file contents
    const workflowContent = await Deno.readTextFile('.github/workflows/ci.yml')
    assertStringIncludes(
      workflowContent,
      'name: CI',
      'Should contain correct workflow name',
    )
    assertStringIncludes(
      workflowContent,
      'pull_request:',
      'Should be configured for pull requests',
    )
    assertStringIncludes(
      workflowContent,
      'branches-ignore:',
      'Should have branches-ignore config',
    )
    assertStringIncludes(
      workflowContent,
      'deno task pre-publish',
      'Should run pre-publish task',
    )
    assertStringIncludes(
      workflowContent,
      'deno task publish --dry-run',
      'Should run publish dry-run',
    )
  } finally {
    cleanupTest()
  }
})
