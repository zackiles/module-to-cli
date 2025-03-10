/**
 * Type for functions that can be analyzed for parameter information
 * @private
 */
type AnalyzableFunction = {
  name: string
  toString(): string
}

/**
 * Extracts function information for error messages
 * @private
 * @param {AnalyzableFunction} fn - The function to extract information from
 * @param {string} [methodName] - Optional method name for class methods
 * @returns {string} The full function/method name
 */
function getFunctionName(
  fn: AnalyzableFunction,
  methodName?: string,
): string {
  const args = [fn, methodName]
  return args.map((arg) => arg?.toString() || '').join('.')
}

/**
 * Extracts parameter information for error messages
 * @private
 * @param {AnalyzableFunction} fn - The function to extract parameter information from
 * @returns {string[]} Array of parameter descriptions
 */
function getParameterInfo(fn: AnalyzableFunction): string[] {
  const args = [fn]
  return args.map((arg) => arg?.toString() || '')
}

/**
 * Error thrown when a method or class is invoked without required arguments
 * @private
 * @class
 */
class MissingArgumentsError extends Error {
  constructor(fn: AnalyzableFunction, methodName?: string) {
    const fullName = getFunctionName(fn, methodName)
    const params = getParameterInfo(fn)
    super(
      `${fullName} invoked with no arguments. Needed arguments: ${
        params.join(', ')
      }`,
    )
    this.name = 'MissingArgumentsError'
  }
}

/**
 * Error thrown when a private method or property is accessed
 * @private
 * @class
 */
class PrivateInvocationError extends Error {
  constructor(fn: AnalyzableFunction, methodName?: string) {
    const fullName = getFunctionName(fn, methodName)
    const params = getParameterInfo(fn)
    super(
      `${fullName} invoked, which is private and shouldn't be accessed. Arguments: ${
        params.join(', ')
      }`,
    )
    this.name = 'PrivateInvocationError'
  }
}

/**
 * @module ComplicatedModule
 * @description A complicated module with many private and public exports for testing AST analysis.
 *
 * @example
 * ```typescript
 * // Using the named export (class)
 * import { ComplicatedModule } from './ComplicatedModule';
 * const processor = new ComplicatedModule({ name: 'MyProcessor' });
 *
 * // Using the default export (instance)
 * import defaultProcessor from './ComplicatedModule';
 * await defaultProcessor.processBatch([
 *   { id: '1', content: 'data', timestamp: Date.now() }
 * ]);
 * ```
 *
 * @version 1.0.0
 * @author System
 * @license MIT
 */

/**
 * Represents a generic item that can be processed
 * @interface
 */
interface Item {
  /** Unique identifier for the item */
  id: string
  /** The actual content of the item */
  content: unknown
  /** Unix timestamp of when the item was created */
  timestamp: number
}

/**
 * SimpleArgsInterfaceType
 * @interface
 */
interface SimpleArgsInterfaceType {
  /** Name of the processor instance */
  name: string
  /** Version number of the processor (defaults to 1.0) */
  version?: number
  /** Timeout in milliseconds for processing operations */
  timeout?: number
}

/**
 * SimpleReturnInterfaceType
 * @interface
 */
interface SimpleReturnInterfaceType {
  /** Whether currently processing */
  isProcessing: boolean
  /** Total number of items in store */
  itemCount: number
}

class InternalThirdLevelClassWithConstructor {
  constructor() {
    throw Error(
      'InternalThirdLevelClassWithConstructor.constructor is not a top or 2nd level class.',
    )
  }
  public publicThirdLevelMethod() {
    throw new Error(
      'InternalThirdLevelClassWithConstructor.publicThirdLevelMethod is not a top or 2nd level method.',
    )
  }
}
class InternalThirdLevelClassNoConstructor {
  public publicThirdLevelMethod() {
    throw new Error(
      'InternalThirdLevelClassNoConstructor.publicThirdLevelMethod is not a top or 2nd level method.',
    )
  }
}

/**
 * A class with multiple public methods and private state management
 * @class
 */
class MultiMethodClass {
  /** Name of the instance */
  public publicInstancePropertyWithNonMethod = new Error(
    'publicInstancePropertyWithNonMethod is not a top or second level property and is of a bad type (error)',
  )
  public internalThirdLevelClassWithConstructor =
    new InternalThirdLevelClassWithConstructor()
  public internalThirdLevelClassNoConstructor =
    InternalThirdLevelClassNoConstructor

  public promiseWrappedInternalThirdLevelClassNoConstructor = Promise.resolve(
    new InternalThirdLevelClassNoConstructor(),
  )

  /**
   * Constructor with a single option typed argument
   * @param {SimpleArgsInterfaceType} arg1 - Configuration options
   * @throws {TypeError} If arg1.name is not provided
   * @throws {MissingArgumentsError} If no arguments are provided
   */
  constructor(arg1?: SimpleArgsInterfaceType) {
    if (!arg1) {
      throw new MissingArgumentsError(
        MultiMethodClass.prototype.publicMethodWithItemArg,
      )
    }
    if (typeof arg1 !== 'object' || arg1 === null) {
      throw new TypeError(`Expected arg1 to be an object of type SimpleArgsInterfaceType, but received ${typeof arg1}: ${arg1}`)
    }
    if (typeof arg1.name !== 'string') {
      throw new TypeError(`Expected arg1.name to be a string, but received ${typeof arg1.name}: ${arg1.name}`)
    }
    if (arg1.version !== undefined && typeof arg1.version !== 'number') {
      throw new TypeError(`Expected arg1.version to be a number, but received ${typeof arg1.version}: ${arg1.version}`)
    }
    if (arg1.timeout !== undefined && typeof arg1.timeout !== 'number') {
      throw new TypeError(`Expected arg1.timeout to be a number, but received ${typeof arg1.timeout}: ${arg1.timeout}`)
    }
  }

  /**
   * Processes a single item
   * @param {Item} arg1 - The item to process
   * @throws {Error} If already processing
   * @throws {TypeError} If input is invalid
   * @returns {[Item]}
   */
  public publicInstanceMethodWithTypedArgAndReturn(arg1?: Item): [Item] {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        MultiMethodClass.prototype.publicInstanceMethodWithTypedArgAndReturn,
      )
    }
    if (typeof arg1 !== 'object' || arg1 === null) {
      throw new TypeError(`Expected arg1 to be an object of type Item, but received ${typeof arg1}: ${arg1}`)
    }
    if (typeof arg1.id !== 'string') {
      throw new TypeError(`Expected arg1.id to be a string, but received ${typeof arg1.id}: ${arg1.id}`)
    }
    if (typeof arg1.timestamp !== 'number') {
      throw new TypeError(`Expected arg1.timestamp to be a number, but received ${typeof arg1.timestamp}: ${arg1.timestamp}`)
    }
    return [arg1]
  }

  /**
   * Retrieves an item by key
   * @param {string} arg1 - The unique identifier
   * @returns {[string]}
   */
  public get = (arg1?: string): [string] => {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(MultiMethodClass.prototype.get)
    }
    if (typeof arg1 !== 'string') {
      throw new TypeError(`Expected arg1 to be a string, but received ${typeof arg1}: ${arg1}`)
    }
    return [arg1]
  }

  /**
   * Validates input
   * @param {Item} arg1 - The item to validate
   * @returns {[Item]}
   * @private
   */
  private _validate(arg1: Item): [Item] {
    throw new PrivateInvocationError(MultiMethodClass.prototype._validate)
  }

  /**
   * Creates a simple return type from simple args type
   * @returns {[SimpleArgsInterfaceType]}
   * @static
   */
  public static createSimpleReturnFromArgs(
    arg1?: SimpleArgsInterfaceType,
  ): [SimpleArgsInterfaceType] {
    if (!arg1) {
      throw new MissingArgumentsError(
        MultiMethodClass.createSimpleReturnFromArgs,
      )
    }
    if (typeof arg1 !== 'object' || arg1 === null) {
      throw new TypeError(`Expected arg1 to be an object of type SimpleArgsInterfaceType, but received ${typeof arg1}: ${arg1}`)
    }
    if (typeof arg1.name !== 'string') {
      throw new TypeError(`Expected arg1.name to be a string, but received ${typeof arg1.name}: ${arg1.name}`)
    }
    if (arg1.version !== undefined && typeof arg1.version !== 'number') {
      throw new TypeError(`Expected arg1.version to be a number, but received ${typeof arg1.version}: ${arg1.version}`)
    }
    if (arg1.timeout !== undefined && typeof arg1.timeout !== 'number') {
      throw new TypeError(`Expected arg1.timeout to be a number, but received ${typeof arg1.timeout}: ${arg1.timeout}`)
    }
    return [arg1]
  }

  /**
   * Gets a SimpleReturnInterfaceType instance
   * @returns {[SimpleReturnInterfaceType]}
   */
  public getSimpleReturnType = (): [SimpleReturnInterfaceType] => {
    return [{
      isProcessing: false,
      itemCount: this.size,
    }]
  }

  /**
   * Processes multiple items
   * @param {Item[]} arg1 - Array of items
   * @throws {Error} If batch size exceeds maximum
   * @throws {TypeError} If any item is invalid
   * @returns {Promise<[Item[]]>}
   */
  public async processBatch(arg1?: Item[]): Promise<[Item[]]> {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(MultiMethodClass.prototype.processBatch)
    }
    if (!Array.isArray(arg1)) {
      throw new TypeError(`Expected arg1 to be an array of Item objects, but received ${typeof arg1}: ${arg1}`)
    }
    for (let i = 0; i < arg1.length; i++) {
      const item = arg1[i];
      if (typeof item !== 'object' || item === null) {
        throw new TypeError(`Expected arg1[${i}] to be an Item object, but received ${typeof item}: ${item}`)
      }
      if (typeof item.id !== 'string') {
        throw new TypeError(`Expected arg1[${i}].id to be a string, but received ${typeof item.id}: ${item.id}`)
      }
      if (typeof item.timestamp !== 'number') {
        throw new TypeError(`Expected arg1[${i}].timestamp to be a number, but received ${typeof item.timestamp}: ${item.timestamp}`)
      }
    }
    return await Promise.resolve([arg1])
  }

  /**
   * Gets total size
   * @returns {number} Current size
   */
  public get size(): number {
    return 1
  }

  /**
   * Public setter with a single argument
   * @param {number} arg1 - Timeout value in milliseconds
   * @throws {Error} If timeout value is negative
   */
  public set publicSetWithSingleArg(arg1: number) {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        Object.getOwnPropertyDescriptor(MultiMethodClass.prototype, 'timeout')
          ?.set as AnalyzableFunction,
      )
    }
  }

  /**
   * Generates unique identifier
   * @returns {[]} Generated ID
   * @private
   * @static
   */
  private static _generateId(): [] {
    throw new PrivateInvocationError(MultiMethodClass._generateId)
  }

  /**
   * publicMethodWithItemArg
   * @param {Item} arg1 - Item to process
   * @returns {[Item]} Tuple containing processed item
   * @throws {Error} If already processing
   * @throws {TypeError} If input is invalid
   * @throws {MissingArgumentsError} If no arguments are provided
   */
  public publicMethodWithItemArg(arg1?: Item): [Item] {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        MultiMethodClass.prototype.publicMethodWithItemArg,
      )
    }
    return [arg1]
  }

  /**
   * publicArrowFunctionWithStringArg
   * @param {string} arg1 - Unique identifier to retrieve item
   * @returns {[string]} Tuple containing retrieved item key
   * @throws {MissingArgumentsError} If no arguments are provided
   */
  public publicArrowFunctionWithStringArg = (arg1?: string): [string] => {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        MultiMethodClass.prototype.publicArrowFunctionWithStringArg,
      )
    }
    return [arg1]
  }

  /**
   * publicStaticFunctionWithNoArgs
   * @returns {[SimpleArgsInterfaceType]} Tuple containing default configuration
   * @static
   */
  public static publicStaticFunctionWithNoArgs(): [SimpleArgsInterfaceType] {
    return [{ name: 'Default' }]
  }

  /**
   * publicAsyncMethodWithItemArrayArg
   * @param {Item[]} arg1 - Array of items to process in batch
   * @returns {Promise<[Item[]]>} Promise of tuple containing processed items
   * @throws {Error} If batch size exceeds maximum
   * @throws {TypeError} If any item is invalid
   * @throws {MissingArgumentsError} If no arguments are provided
   */
  public async publicAsyncMethodWithItemArrayArg(
    arg1?: Item[],
  ): Promise<[Item[]]> {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        MultiMethodClass.prototype.publicAsyncMethodWithItemArrayArg,
      )
    }
    return await Promise.resolve([arg1])
  }

  /**
   * publicSetterWithNumberArg
   * @param {number} arg1 - Timeout duration in milliseconds
   * @throws {Error} If timeout value is negative
   * @throws {MissingArgumentsError} If no arguments are provided
   */
  public set publicSetterWithNumberArg(arg1: number) {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        Object.getOwnPropertyDescriptor(
          MultiMethodClass.prototype,
          'publicSetterWithNumberArg',
        )
          ?.set as AnalyzableFunction,
      )
    }
  }

  /**
   * privateStaticFunctionWithNoArgs
   * @returns {[]} Empty tuple
   * @private
   * @static
   * @throws {PrivateInvocationError} If called from outside the class
   */
  private static privateStaticFunctionWithNoArgs(): [] {
    throw new PrivateInvocationError(
      MultiMethodClass.privateStaticFunctionWithNoArgs,
    )
  }
}

/**
 * Default instance with standard configuration
 */
const defaultInstance = new MultiMethodClass({
  name: 'DefaultProcessor',
  version: 1.0,
  timeout: 1,
})

/**
 * publicFunctionWithFunctionAndNumberArgs
 * @param {Function} arg1 - Function to be debounced
 * @param {number} arg2 - Delay duration in milliseconds
 * @returns {[T, number]} Tuple of debounced function and delay
 * @throws {MissingArgumentsError} If no arguments are provided
 */
const publicFunctionWithFunctionAndNumberArgs = <
  T extends (...args: unknown[]) => unknown,
>(
  arg1?: T,
  arg2?: number,
): [T, number] => {
  if (arg1 === undefined || arg2 === undefined) {
    throw new MissingArgumentsError(publicFunctionWithFunctionAndNumberArgs)
  }
  if (typeof arg1 !== 'function') {
    throw new TypeError(`Expected arg1 to be a function, but received ${typeof arg1}: ${arg1}`)
  }
  if (typeof arg2 !== 'number') {
    throw new TypeError(`Expected arg2 to be a number, but received ${typeof arg2}: ${arg2}`)
  }
  return [arg1, arg2]
}

/**
 * publicArrowFunctionWithFunctionArg
 * @param {Function} arg1 - Function to be memoized
 * @returns {[T]} Tuple containing memoized function
 * @throws {MissingArgumentsError} If no arguments are provided
 */
const publicArrowFunctionWithFunctionArg = <
  T extends (...args: unknown[]) => unknown,
>(
  arg1?: T,
): [T] => {
  if (arg1 === undefined) {
    throw new MissingArgumentsError(publicArrowFunctionWithFunctionArg)
  }
  if (typeof arg1 !== 'function') {
    throw new TypeError(`Expected arg1 to be a function, but received ${typeof arg1}: ${arg1}`)
  }
  return [arg1]
}

/**
 * publicFunctionWithUnknownArg
 * @param {unknown} arg1 - Content to create item from
 * @returns {[unknown]} Tuple containing created item
 * @throws {MissingArgumentsError} If no arguments are provided
 */
const publicFunctionWithUnknownArg = (arg1?: unknown): [unknown] => {
  if (arg1 === undefined) {
    throw new MissingArgumentsError(publicFunctionWithUnknownArg)
  }
  return [arg1]
}

/**
 * publicArrowFunctionWithUnknownArg
 * @param {unknown} arg1 - Object to validate
 * @returns {[unknown]} Type guard result tuple
 * @throws {MissingArgumentsError} If no arguments are provided
 */
const publicArrowFunctionWithUnknownArg = (arg1: unknown): [unknown] => {
  if (arg1 === undefined) {
    throw new MissingArgumentsError(publicArrowFunctionWithUnknownArg)
  }
  return [arg1]
}

/**
 * Creates batch of items
 * @param {unknown[]} arg1 - Array of content
 * @returns {[unknown[]]} Array of items
 * @throws {MissingArgumentsError} If no arguments are provided
 */
const publicArrowFunctionWithUnknownArrayArgs = (
  arg1?: unknown[],
): [unknown[]] => {
  if (arg1 === undefined) {
    throw new MissingArgumentsError(publicArrowFunctionWithUnknownArrayArgs)
  }
  if (!Array.isArray(arg1)) {
    throw new TypeError(`Expected arg1 to be an array, but received ${typeof arg1}: ${arg1}`)
  }
  return [arg1]
}

/**
 * publicAsyncFunctionWithTypedArgs
 * @param {Item[]} arg1 - Random array of type Item
 * @param {number} arg2 - Random number
 * @returns {Promise<[Item[], number]>}
 * @throws {MissingArgumentsError} If no arguments are provided
 */
async function publicAsyncFunctionWithTypedArgs(
  arg1?: Item[],
  arg2?: number,
): Promise<[Item[], number]> {
  if (arg1 === undefined || arg2 === undefined) {
    throw new MissingArgumentsError(publicAsyncFunctionWithTypedArgs)
  }
  if (!Array.isArray(arg1)) {
    throw new TypeError(`Expected arg1 to be an array of Item objects, but received ${typeof arg1}: ${arg1}`)
  }
  for (let i = 0; i < arg1.length; i++) {
    const item = arg1[i]
    if (typeof item !== 'object' || item === null) {
      throw new TypeError(`Expected arg1[${i}] to be an Item object, but received ${typeof item}: ${item}`)
    }
    if (typeof (item as Item).id !== 'string') {
      throw new TypeError(`Expected arg1[${i}].id to be a string, but received ${typeof (item as any).id}: ${(item as any).id}`)
    }
    if (typeof (item as Item).timestamp !== 'number') {
      throw new TypeError(`Expected arg1[${i}].timestamp to be a number, but received ${typeof (item as any).timestamp}: ${(item as any).timestamp}`)
    }
  }
  
  if (typeof arg2 !== 'number') {
    throw new TypeError(`Expected arg2 to be a number, but received ${typeof arg2}: ${arg2}`)
  }
  return await Promise.resolve([arg1, arg2])
}

/**
 * Class with no constructor and one public method
 * @class
 */
class PublicMethodClass {
  /** Transform data */
  public publicMethod(arg1?: unknown): [unknown] {
    if (arg1 === undefined) {
      throw new MissingArgumentsError(
        PublicMethodClass.prototype.publicMethod,
      )
    }
    if (arg1 === null) {
      throw new TypeError(`Expected arg1 to be a non-null value, but received null`)
    }
    return [arg1]
  }
}

/**
 * Class with constructor and private method only
 * @class
 */
class PrivateMethodClass {
  constructor() {
  }
  /** Transform data */
  private privateMethod(): void {
    throw new PrivateInvocationError(
      PrivateMethodClass.prototype.privateMethod,
    )
  }
}

const publicMethodInstance = new PublicMethodClass()
const privateMethodInstance = new PrivateMethodClass()

export type { Item, SimpleArgsInterfaceType, SimpleReturnInterfaceType }

// Re-export a commonly available object from Deno standard library
export { assert } from "@std/assert"

const externalClass = Number
const externalFunction = parseInt

export {
  MultiMethodClass,
  PublicMethodClass,
  PrivateMethodClass,
  publicAsyncFunctionWithTypedArgs,
  publicFunctionWithFunctionAndNumberArgs,
  publicArrowFunctionWithFunctionArg,
  publicFunctionWithUnknownArg,
  publicArrowFunctionWithUnknownArg,
  publicArrowFunctionWithUnknownArrayArgs,
  publicMethodInstance,
  privateMethodInstance,
  // External exports for testing re-export detection
  externalClass,
  externalFunction,
}

export default defaultInstance
