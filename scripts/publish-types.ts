/**
 * @module publish-types
 * @description Shared type definitions used across the publishing process
 */

/**
 * Type of version bump to perform
 */
export type BumpType = 'major' | 'minor' | 'patch' | null

/**
 * Generic JSON object type
 */
export type JsonObject = Record<string, unknown>

/**
 * Configuration file with path and data
 */
export type ConfigFile = { path: string; data: string } | null

/**
 * Step in a transaction process with execution and rollback capabilities
 */
export interface TransactionStep<T> {
  /** Name of this step for logging */
  name: string
  /** Function to execute this step */
  execute: () => Promise<T>
  /** Function to rollback this step if needed */
  rollback: () => Promise<void> | void
  /** Whether this step has been executed and requires rollback */
  requiresRollback: boolean
  /** Result of the execution if successful */
  result?: T
}

/**
 * Options for the package publishing process
 */
export interface PublishOptions {
  /** Don't actually make any changes, just report what would happen */
  dryRun?: boolean
  /** Skip the JSR publication step */
  skipPublish?: boolean
  /** Allow publishing with uncommitted changes */
  allowDirty?: boolean
  /** Alternative path to changelog file */
  changelogPath?: string
  /** Alternative config file paths to check */
  configFiles?: string[]
}

/**
 * Result of the package publishing process
 */
export interface PublishResult {
  /** The version before the update */
  oldVersion: string
  /** The new version that was published */
  newVersion: string
  /** The type of version bump that was performed */
  bumpType: BumpType
  /** Whether the publication was successful */
  success: boolean
  /** Any error message if the publication failed */
  errorMessage?: string
}

/**
 * Result of updating the config file
 */
export interface ConfigUpdateResult {
  originalContent: string
  updatedPath: string
}

/**
 * Result of updating the changelog file
 */
export interface ChangelogUpdateResult {
  originalContent: string
  fileExistedBefore: boolean
  path: string
}

/**
 * Result of creating a Git release
 */
export interface GitReleaseResult {
  tagName: string
  currentHead: string
}

/**
 * Result of publishing to JSR
 */
export interface JSRPublishResult {
  published: boolean
}

/**
 * Union type of all step result types
 */
export type StepResultType =
  | ConfigUpdateResult
  | ChangelogUpdateResult
  | GitReleaseResult
  | JSRPublishResult
