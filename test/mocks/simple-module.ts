/**
 * @module SimpleModule
 * @description A simple module with just a few public exports for testing AST analysis.
 *

/**
 * Greets a person with a custom message
 * @param {string} name - The name of the person to greet
 * @param {string} [greeting="Hello"] - Optional custom greeting
 * @returns {string} The greeting message
 */
export function greet(name: string, greeting = 'Hello'): string {
  // Modified type validation to be more permissive
  // Allow undefined name and treat it as 'undefined' string
  const nameStr = name === undefined ? 'undefined' : name
  
  // Check if name is not undefined but also not a string
  if (name !== undefined && typeof name !== 'string') {
    throw new TypeError(`Expected name to be a string, but received ${typeof name}: ${name}`)
  }
  
  if (greeting !== undefined && typeof greeting !== 'string') {
    throw new TypeError(`Expected greeting to be a string, but received ${typeof greeting}: ${greeting}`)
  }
  
  return `${greeting}, ${nameStr}!`
}

/**
 * Adds two numbers together
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum of a and b
 */
export function add(a: number, b: number): number {
  if (typeof a !== 'number') {
    throw new TypeError(`Expected a to be a number, but received ${typeof a}: ${a}`)
  }
  if (typeof b !== 'number') {
    throw new TypeError(`Expected b to be a number, but received ${typeof b}: ${b}`)
  }
  return a + b
}

/**
 * A test class with various methods
 */
export class Calculator {
  private value: number

  /**
   * Creates a new Calculator
   * @param {number} [initialValue=0] - Initial value for the calculator
   */
  constructor(initialValue = 0) {
    if (typeof initialValue !== 'number') {
      throw new TypeError(`Expected initialValue to be a number, but received ${typeof initialValue}: ${initialValue}`)
    }
    this.value = initialValue
  }

  /**
   * Adds a number to the current value
   * @param {number} x - Number to add
   * @returns {number} The new value
   */
  add(x: number): number {
    if (typeof x !== 'number') {
      throw new TypeError(`Expected x to be a number, but received ${typeof x}: ${x}`)
    }
    this.value += x
    return this.value
  }

  /**
   * Subtracts a number from the current value
   * @param {number} x - Number to subtract
   * @returns {number} The new value
   */
  subtract(x: number): number {
    if (typeof x !== 'number') {
      throw new TypeError(`Expected x to be a number, but received ${typeof x}: ${x}`)
    }
    this.value -= x
    return this.value
  }

  /**
   * Gets the current value
   * @returns {number} The current value
   */
  getValue(): number {
    return this.value
  }
}
