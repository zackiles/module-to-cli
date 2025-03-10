/**
 * @module publish-log
 * @description Logging utility for GitHub Actions and console output
 */

import { cyan, green, red, yellow } from '@std/fmt/colors'

/**
 * Logging utility for GitHub Actions and console output
 */
const log = {
  /**
   * Debug level logs (only visible when ACTIONS_STEP_DEBUG is enabled)
   */
  debug(message: string): void {
    console.log(`::debug::${message}`)
  },

  /**
   * Information level logs (standard output)
   */
  info(message: string): void {
    const prefix = 'ℹ️'
    console.log(`${prefix} ${cyan(message)}`)
  },

  /**
   * Notice level logs (highlighted in GitHub Actions UI)
   */
  notice(message: string): void {
    const prefix = 'ℹ️'
    console.log(`${prefix} ${cyan(message)}`)
    console.log(`::notice::${message}`)
  },

  /**
   * Warning level logs (highlighted yellow in GitHub Actions UI)
   */
  warning(message: string): void {
    const prefix = '⚠️'
    console.log(`${prefix} ${yellow(message)}`)
    console.log(`::warning::${message}`)
  },

  /**
   * Error level logs (highlighted red in GitHub Actions UI)
   */
  error(message: string): void {
    const prefix = '❌'
    console.log(`${prefix} ${red(message)}`)
    console.log(`::error::${message}`)
  },

  /**
   * Success level logs (green)
   */
  success(message: string): void {
    const prefix = '✅'
    console.log(`${prefix} ${green(message)}`)
  },

  /**
   * Start a collapsible group in GitHub Actions logs
   */
  groupStart(title: string): void {
    console.log(`::group::${title}`)
  },

  /**
   * End a collapsible group in GitHub Actions logs
   */
  groupEnd(): void {
    console.log('::endgroup::')
  },
}

export { log }
