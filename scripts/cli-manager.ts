// Automatically load environment variables from a `.env` file
import '@std/dotenv/load'
import {
  parseArgs,
  type ParseOptions,
  promptSecret, // Unused in the example below but imported for illustration
  type PromptSecretOptions,
} from '@std/cli'
import {
  promptSelect,
  type PromptSelectOptions,
} from '@std/cli/unstable-prompt-select'
import {
  ProgressBar, // Unused in the example below but imported for illustration
  ProgressBarFormatter, // Unused in the example below but imported for illustration
  type ProgressBarOptions,
} from '@std/cli/unstable-progress-bar'
import {
  Spinner, // Unused in the example below but imported for illustration
  type SpinnerOptions,
} from '@std/cli/unstable-spinner'
import {
  promptMultipleSelect, // Unused in the example below but imported for illustration
  type PromptMultipleSelectOptions,
} from '@std/cli/unstable-prompt-multiple-select'

type CommandOptions =
  | PromptSelectOptions
  | PromptMultipleSelectOptions
  | PromptSecretOptions
  | ProgressBarOptions
  | SpinnerOptions

// Define an interface for CLI command configuration
interface CommandConfiguration {
  // A name to give the command that describes the return value you expect to get
  name: string
  // A function returning a string (or null) that can accept different parameter shapes
  // deno-lint-ignore ban-types
  command: Function
  // Message passed to the command as the prompt message
  message: string
  // Values passed to the command as selectable options
  values?: string[]
  // Default value if a user chooses nothing
  defaultValue?: string
  // Options passed to the command, enforcing only the valid types
  options?: CommandOptions
  // Handler function that receives the result of the command (the string or null)
  handler?: (result: string | null) => Promise<unknown> | unknown
}

// Define the commands array containing our CLI commands
const commands: CommandConfiguration[] = [
  {
    // A name to give the command that describes the return value you expect to get
    name: 'BROWSER_NAME',
    // Use promptSelect as the command function to prompt for a browser selection
    command: promptSelect,
    // The prompt message for selecting a browser
    message: 'Please select a browser:',
    // The selectable browser options
    values: ['safari', 'chrome', 'firefox'],
    // Default value if nothing is selected
    defaultValue: 'chrome',
    // Enforce PromptSelectOptions type (which only has "clear")
    options: { clear: true } as PromptSelectOptions,
    // Handler to process the selected browser (could include further processing)
    handler: (result) => {
      console.log('Final browser selection:', result)
      return result
    },
  },
]

// Orchestrator function: iterates over the commands and runs them sequentially.
// Each command's result is passed to its handler (if provided) after resolution.
async function runCommands(cmds: CommandConfiguration[]) {
  const results = []

  for (const cmd of cmds) {
    // Prepare the message, append default value info if available
    let displayMessage = cmd.message
    if (cmd.defaultValue) {
      displayMessage = `${displayMessage} (default: ${cmd.defaultValue})`
    }

    // Invoke the command function with its message, values, and options.
    // The function may be asynchronous (like promptSelect).
    let result = await cmd.command(
      displayMessage,
      cmd.values || [],
      cmd.options,
    )

    // Use defaultValue if result is null and defaultValue exists
    if (result === null && cmd.defaultValue) {
      result = cmd.defaultValue
    }

    // Call the handler with the result if a handler is provided.
    let handlerResult = result
    if (cmd.handler) {
      handlerResult = await cmd.handler(result)
    }

    // Add result to our results array
    results.push({
      command: cmd.name,
      return: handlerResult,
    })
  }

  return results
}

// CLI setup function: parses arguments and environment variables, modifies the commands object accordingly.
async function setupCommands(options: ParseOptions) {
  // Check if running from a Deno task or npx, and adjust Deno.args accordingly.
  const firstArg = Deno.args[0] || ''
  const isDenoTask = firstArg.startsWith('task:')
  const isNpxRun = firstArg.includes('npx')
  const adjustedArgs = isDenoTask || isNpxRun ? Deno.args.slice(1) : Deno.args

  // Parse command-line arguments
  const parsedArgs = parseArgs(adjustedArgs, options)

  /**
   * Now you could access the parseArgs, for example:
   * console.log('Help:', parsedArgs.help) // e.g., true if `--help` was passed
   * console.log('Verbose:', parsedArgs.verbose) // e.g., true if `--verbose` was passed, false if `--no-verbose`, else default false
   * console.log('Config file:', parsedArgs.config) // e.g., "config.json" if provided
   * console.log('Include paths:', parsedArgs.include) // e.g., ["src", "lib"] if provided
   * console.log('Remaining arguments:', parsedArgs._) // e.g., ["file.txt"] if provided
   * console.log("Arguments after '--':", parsedArgs['--']) // e.g., ["--raw", "data"] if provided
   */

  // Create a copy of the commands array to avoid modifying the original
  const filteredCommands = [...commands]

  // Ensure defaultValue is the first element in values array when both are set
  for (const cmd of filteredCommands) {
    if (cmd.defaultValue && cmd.values && cmd.values.length > 0) {
      // If defaultValue exists in values, remove it first to avoid duplicates
      const valueIndex = cmd.values.indexOf(cmd.defaultValue)
      if (valueIndex !== -1) {
        cmd.values.splice(valueIndex, 1)
      }
      // Add defaultValue as the first element in values
      cmd.values.unshift(cmd.defaultValue)
    }
  }

  const results = []

  // For each command, check if an environment variable with the same name exists
  for (let i = filteredCommands.length - 1; i >= 0; i--) {
    const cmd = filteredCommands[i]
    const envValue = Deno.env.get(cmd.name)

    if (envValue) {
      console.log(`Environment variable ${cmd.name} is set to:`, envValue)

      // Add the environment variable value to results
      results.push({
        command: cmd.name,
        return: envValue,
      })

      // Remove this command from the filtered list since we already have the value
      filteredCommands.splice(i, 1)
    }
  }

  // Run the remaining commands sequentially and get their results
  const commandResults = await runCommands(filteredCommands)

  // Combine environment variable results with command results
  const combinedResults = [...results, ...commandResults]

  // Return the combined results for further processing
  return combinedResults
}

// Define ParseOptions for parseArgs
const options: ParseOptions = {
  boolean: ['help', 'verbose'], // Treat --help and --verbose as boolean flags
  string: ['config'], // Treat --config as a string
  default: { verbose: false }, // Default value for --verbose is false
  alias: { h: 'help', v: 'verbose' }, // Aliases: -h for --help, -v for --verbose
  collect: ['include'], // Collect multiple --include options into an array
  negatable: ['verbose'], // Allow --no-verbose to negate --verbose
  '--': true, // Capture arguments after '--' into a separate array
}

// Main function to execute the CLI setup
async function main() {
  // Parse command line arguments first to get access to the verbose flag
  const parsedArgs = parseArgs(Deno.args, options)

  const results = await setupCommands(options)

  // Only display results if verbose flag is set
  if (parsedArgs.verbose) {
    console.log('Command Results:', JSON.stringify(results, null, 2))
  }

  return results
}

// Ensure the script only runs when executed as a CLI
if (import.meta.main) {
  main()
}
