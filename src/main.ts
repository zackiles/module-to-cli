#!/usr/bin/env -S deno run --allow-all

/**
 * @module main
 * @description Generates a dynamic CLI interface for any TypeScript module
 * based on its JSON specification.
 *
 * @example
 * ```typescript
 * // Example 1: List all available methods in a module
 * module-to-cli path/to/module.ts
 *
 * // Example 2: Call a class method with constructor arguments and method parameters
 * module-to-cli path/to/database.ts Database.query \
 *   --constructor.connectionString="postgres://user:pass@localhost/db" \
 *   --constructor.poolSize=5 \
 *   --sql="SELECT * FROM users WHERE age > $1" \
 *   --params='[18]' \
 *   --timeout=5000
 *
 * // Example 3: Call a top-level function with shorthand arguments
 * module-to-cli path/to/your-module.ts formatDate \
 *   --d="2023-05-15" \
 *   --f="YYYY-MM-DD" \
 *   --locale="en-US"
 * ```
 */

import { parseArgs } from '@std/cli'
import { MethodInfo, ModuleSpec, TypeInfo } from './types.ts'
import { ModuleToCLI } from './parse.ts'
import { main as cliMain } from './spec.ts'
import {
  printError,
  printMenu,
  printMenuForModule,
  printSimpleModuleInfo,
} from './print.ts'

/**
 * Converts a string value to the appropriate type based on TypeInfo
 * @param value - String value to convert
 * @param type - Type information
 * @returns Converted value
 */
function convertValue(
  value: string,
  type: TypeInfo,
): string | number | boolean | null | object | unknown[] {
  if (type.isNullable && (value === 'null' || value === 'undefined')) {
    return null
  }

  switch (type.baseType) {
    case 'number':
      return Number(value)
    case 'boolean':
      return value === 'true'
    case 'object':
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    case 'array':
      try {
        return JSON.parse(value)
      } catch {
        return value.split(',').map((item) => item.trim())
      }
    default:
      return value
  }
}

/**
 * Gets constructor arguments from command line arguments
 * @param args - Parsed command line arguments
 * @param constructorInfo - Constructor method information
 * @returns Array of constructor arguments
 */
function getConstructorArgs(
  args: Record<string, string | number | boolean | unknown>,
  constructorInfo?: MethodInfo,
): unknown[] {
  if (!constructorInfo || !constructorInfo.params.length) {
    return []
  }

  return constructorInfo.params.map((param) => {
    const argKey = `constructor.${param.name}`

    if (args[argKey] !== undefined) {
      return convertValue(String(args[argKey]), param.type)
    }

    return undefined
  })
}

/**
 * Gets method arguments from command line arguments
 * @param args - Parsed command line arguments
 * @param methodInfo - MethodInfo
 * @returns Array of method arguments
 */
function getMethodArgs(
  args: Record<string, string | number | boolean | unknown>,
  methodInfo: MethodInfo,
): unknown[] {
  if (!methodInfo.params.length) {
    return []
  }

  return methodInfo.params.map((param) => {
    if (args[param.name] !== undefined) {
      return convertValue(String(args[param.name]), param.type)
    }

    return undefined
  })
}

/**
 * Parses a TypeScript module and returns its specification
 * @param modulePath - Path to the module
 * @returns Module specification or null if parsing fails
 */
async function parseModule(modulePath: string): Promise<ModuleSpec | null> {
  try {
    const moduleToCLI = new ModuleToCLI(modulePath)
    const parsedModule = await moduleToCLI.get()

    return {
      methods: parsedModule.methods,
      module: printSimpleModuleInfo(parsedModule.module),
    }
  } catch (error) {
    printError(`Failed to parse module: ${modulePath}`, error)
    return null
  }
}

/**
 * Imports a TypeScript module
 * @param modulePath - Path to the module
 * @returns Imported module or null if import fails
 */
async function importModule(
  modulePath: string,
): Promise<Record<string, unknown> | null> {
  try {
    const workingDir = Deno.cwd()
    let moduleName = modulePath

    if (!modulePath.startsWith('/')) {
      moduleName = `${workingDir}/${modulePath}`
    }

    moduleName = `file://${moduleName}`

    return await import(moduleName)
  } catch (error) {
    printError(`Failed to import module: ${modulePath}`, error)
    return null
  }
}

/**
 * Executes a function from the imported module
 * @param module - Imported module
 * @param methodName - Name of the method to execute
 * @param methodInfo - Method information
 * @param args - Command line arguments
 * @returns Result of the function execution or null if execution fails
 */
async function executeFunctionMethod(
  module: Record<string, unknown>,
  methodName: string,
  methodInfo: MethodInfo,
  args: Record<string, string | number | boolean | unknown>,
): Promise<unknown> {
  const fn = module[methodName.split('.')[0]] as (...args: unknown[]) => unknown
  if (!fn) {
    console.error(`Function not found in module: ${methodName}`)
    return null
  }

  const methodArgs = getMethodArgs(args, methodInfo)
  try {
    return methodInfo.isAsync ? await fn(...methodArgs) : fn(...methodArgs)
  } catch (error) {
    printError(`Error executing function: ${methodName}`, error)
    return null
  }
}

/**
 * Executes an instance method from a class in the imported module
 * @param module - Imported module
 * @param methodName - Name of the method to execute
 * @param methodInfo - Method information
 * @param args - Command line arguments
 * @param spec - Module specification
 * @param constructorArgs - Constructor arguments
 * @returns Result of the method execution or null if execution fails
 */
async function executeInstanceMethod(
  module: Record<string, unknown>,
  methodName: string,
  methodInfo: MethodInfo,
  args: Record<string, string | number | boolean | unknown>,
  spec: ModuleSpec,
  constructorArgs: Record<string, string> = {},
): Promise<unknown> {
  const parts = methodName.split('.')
  if (parts.length < 2) {
    console.error(`Invalid class method name: ${methodName}`)
    return null
  }

  const className = parts[0]
  const method = parts[1]

  const ClassConstructor = module[className] as new (
    ...args: unknown[]
  ) => unknown
  if (!ClassConstructor) {
    console.error(`Class not found in module: ${className}`)
    return null
  }

  try {
    const constructorInfo = spec.methods[`${className}.constructor`]
    let constructorValues: unknown[] = []

    if (constructorInfo && constructorInfo.params.length > 0) {
      constructorValues = constructorInfo.params.map((param) => {
        const argKey = `constructor.${param.name}`
        if (argKey in constructorArgs) {
          return convertValue(constructorArgs[argKey], param.type)
        }
        return undefined
      })
    }

    const instance = new ClassConstructor(...constructorValues)
    const methodArgs = getMethodArgs(args, methodInfo)

    return methodInfo.isAsync
      ? await (instance as Record<string, (...args: unknown[]) => unknown>)
        [method](
          ...methodArgs,
        )
      : (instance as Record<string, (...args: unknown[]) => unknown>)[method](
        ...methodArgs,
      )
  } catch (error) {
    printError(`Error executing instance method: ${methodName}`, error)
    return null
  }
}

/**
 * Executes a static method from a class in the imported module
 * @param module - Imported module
 * @param methodName - Name of the method to execute
 * @param methodInfo - Method information
 * @param args - Command line arguments
 * @returns Result of the method execution or null if execution fails
 */
async function executeStaticMethod(
  module: Record<string, unknown>,
  methodName: string,
  methodInfo: MethodInfo,
  args: Record<string, string | number | boolean | unknown>,
): Promise<unknown> {
  const parts = methodName.split('.')
  if (parts.length < 2) {
    console.error(`Invalid static method name: ${methodName}`)
    return null
  }

  const className = parts[0]
  const method = parts[1]

  const ClassConstructor = module[className] as new (
    ...args: unknown[]
  ) => unknown
  if (!ClassConstructor) {
    console.error(`Class not found in module: ${className}`)
    return null
  }

  try {
    const methodArgs = getMethodArgs(args, methodInfo)

    return methodInfo.isAsync
      ? await (ClassConstructor as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >)
        [method](...methodArgs)
      : (ClassConstructor as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >)
        [method](...methodArgs)
  } catch (error) {
    printError(`Error executing static method: ${methodName}`, error)
    return null
  }
}

/**
 * Checks if all required parameters are provided
 * @param methodInfo - Method information
 * @param flags - Command line flags
 * @returns Array of missing parameter names or empty array if all required parameters are provided
 */
function getMissingParams(
  methodInfo: MethodInfo,
  flags: Record<string, unknown>,
): string[] {
  return methodInfo.params
    .filter((param) =>
      !param.optional && !(param.name in flags) &&
      !(param.name.charAt(0) in flags)
    )
    .map((param) => param.name)
}

/**
 * Main function to process command line arguments and execute the requested method.
 * Supports two modes of operation:
 * 1. Standard mode: Executes methods from the specified module
 * 2. Generate mode: When first argument is 'generate', runs the specification generator
 */
async function main() {
  if (Deno.args.length > 0 && Deno.args[0] === 'generate') {
    await cliMain()
    return
  }

  const flags = parseArgs(Deno.args, {
    boolean: ['help'],
    alias: { h: 'help' },
    default: {},
    unknown: () => true,
  })

  const rawArgs = Deno.args
  const constructorArgs: Record<string, string> = {}

  for (const arg of rawArgs) {
    if (arg.startsWith('--constructor.')) {
      const parts = arg.substring(2).split('=')
      if (parts.length >= 2) {
        const key = parts[0]
        const value = parts.slice(1).join('=')
        constructorArgs[key] = value
      }
    }
  }

  if (flags.help || flags._.length < 1) {
    printMenu()
    return
  }

  const modulePath = String(flags._[0])
  const methodName = flags._.length > 1 ? String(flags._[1]) : undefined

  const spec = await parseModule(modulePath)
  if (!spec) return

  if (!methodName) {
    printMenuForModule(spec)
    return
  }

  const methodInfo = spec.methods[methodName]
  if (!methodInfo) {
    console.error(`Method not found: ${methodName}`)
    printMenuForModule(spec)
    return
  }

  if (methodInfo.visibility !== 'public') {
    console.error(`Method ${methodName} is not public`)
    return
  }

  const missingParams = getMissingParams(methodInfo, flags)
  if (missingParams.length > 0) {
    console.error(
      `Error: Missing required parameters: ${missingParams.join(', ')}`,
    )
    console.error(
      `Method signature: ${methodName}(${
        methodInfo.params.map((p) =>
          `${p.name}${p.optional ? '?' : ''}: ${p.type.rawType}`
        ).join(', ')
      })`,
    )
    return
  }

  const module = await importModule(modulePath)
  if (!module) return

  let result: unknown = null

  if (methodInfo.methodKind === 'function') {
    result = await executeFunctionMethod(module, methodName, methodInfo, flags)
  } else if (methodInfo.methodKind === 'instance') {
    result = await executeInstanceMethod(
      module,
      methodName,
      methodInfo,
      flags,
      spec,
      constructorArgs,
    )
  } else if (methodInfo.methodKind === 'static') {
    result = await executeStaticMethod(module, methodName, methodInfo, flags)
  } else {
    console.error(`Unsupported method kind: ${methodInfo.methodKind}`)
    return
  }

  if (result !== null) {
    console.log(Deno.inspect(result, { depth: 4, colors: true }))
  }
}

if (import.meta.main) {
  await main()
}

export default main
