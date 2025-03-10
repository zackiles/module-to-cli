/**
 * @module types
 * @description Centralized type definitions for the module-to-cli project
 */

/**
 * Represents type information extracted from TypeScript declarations
 */
interface TypeInfo {
  /** Base type name */
  baseType: string
  /** Type arguments for generic types */
  typeArguments?: TypeInfo[]
  /** Union type components */
  unionTypes?: TypeInfo[]
  /** Intersection type components */
  intersectionTypes?: TypeInfo[]
  /** Whether the type is optional */
  isOptional: boolean
  /** Whether the type is nullable */
  isNullable: boolean
  /** Raw type string representation */
  rawType: string
}

/**
 * Information about a method parameter
 */
interface ParamInfo {
  /** Parameter name */
  name: string
  /** Parameter type */
  type: TypeInfo
  /** Parameter description from JSDoc */
  description: string
  /** Whether the parameter is optional */
  optional: boolean
}

/**
 * Information about a method's return value
 */
interface ReturnInfo {
  /** Return type */
  type: TypeInfo
  /** Return description from JSDoc */
  description: string
}

/**
 * Possible kinds of methods in a module
 */
type MethodKind =
  | 'instance'
  | 'static'
  | 'property'
  | 'getter'
  | 'setter'
  | 'function'
  | 'constructor'

/**
 * Visibility level of a method or property
 */
type Visibility = 'public' | 'private' | 'protected'

/**
 * Comprehensive information about a method
 */
interface MethodInfo {
  /** Method name */
  name: string
  /** Method parameters */
  params: ParamInfo[]
  /** Method description from JSDoc */
  description: string
  /** Method return information */
  returns: ReturnInfo | null
  /** Kind of method */
  methodKind: MethodKind
  /** Whether the method is async */
  isAsync: boolean
  /** Method visibility */
  visibility: Visibility
}

/**
 * Comprehensive information about a method with enhanced type details
 */
interface EnhancedMethodInfo {
  /** Method name */
  name: string
  /** Method parameters */
  params: ParamInfo[]
  /** Method description from JSDoc */
  description: string
  /** Method return information */
  returns: ReturnInfo | null
  /** Kind of method */
  methodKind: MethodKind
  /** Whether the method is async */
  isAsync: boolean
  /** Method visibility */
  visibility: Visibility
}

/**
 * Information about module imports
 */
interface ImportInfo {
  /** Name of the imported module */
  moduleName: string
  /** Whether it's a default import */
  isDefault: boolean
  /** Whether it's imported as namespace */
  isNamespace: boolean
  /** Named imports from the module */
  namedImports: string[]
}

/**
 * Information about module exports
 */
interface ExportInfo {
  /** Name of the exported item */
  name: string
  /** Whether it's a default export */
  isDefault: boolean
  /** Whether it's a re-export */
  isReexport: boolean
  /** Source module of re-exports */
  sourceModule?: string
}

/**
 * Information about a module
 */
interface ModuleInfo {
  /** Module name */
  name: string
  /** Module description from JSDoc */
  description: string
  /** Module file name */
  fileName: string
  /** Module imports */
  imports: ImportInfo[]
  /** Module exports */
  exports: ExportInfo[]
}

/**
 * Result of parsing a module
 */
interface ParsedModuleResult {
  /** Methods extracted from the module */
  methods: Record<string, MethodInfo>
  /** Module metadata */
  module: ModuleInfo
}

/**
 * Configuration for the AST parser
 */
interface ASTParserConfig {
  /** Whether to capture instance methods */
  captureInstanceMethods: boolean
  /** Whether to capture static methods */
  captureStaticMethods: boolean
  /** Whether to capture property methods */
  capturePropertyMethods: boolean
  /** Whether to capture getter accessors */
  captureGetAccessors: boolean
  /** Whether to capture setter accessors */
  captureSetAccessors: boolean
  /** Whether to capture arrow functions */
  captureArrowFunctions: boolean
  /** Whether to capture complex types */
  captureComplexTypes: boolean
}

/**
 * Default configuration for the AST parser
 */
const DEFAULT_AST_CONFIG: ASTParserConfig = {
  captureInstanceMethods: true,
  captureStaticMethods: true,
  capturePropertyMethods: true,
  captureGetAccessors: true,
  captureSetAccessors: true,
  captureArrowFunctions: true,
  captureComplexTypes: true,
}

/**
 * Simplified type information for display
 */
interface SimplifiedTypeInfo {
  /** Type string representation */
  type: string
  /** Type description */
  description: string
}

/**
 * Simplified method information for display
 */
interface SimplifiedMethodInfo {
  /** Method name */
  name: string
  /** Simplified method parameters */
  params: {
    name: string
    type: string
    description: string
    optional: boolean
  }[]
  /** Method description */
  description: string
  /** Simplified return type */
  returns: SimplifiedTypeInfo | null
  /** Kind of method */
  methodKind: MethodKind
}

/**
 * Type for functions that can be analyzed for parameter information
 */
type AnalyzableFunction = {
  /** Function name */
  name: string
  /** String representation of the function */
  toString(): string
}

/**
 * Simplified import information for display
 */
interface SimplifiedImportInfo {
  /** Name of the imported module */
  module: string
  /** Whether it's a default import */
  isDefault: boolean
  /** Whether it's imported as namespace */
  isNamespace: boolean
  /** Named imports from the module */
  namedImports: string[]
}

/**
 * Simplified export information for display
 */
interface SimplifiedExportInfo {
  /** Name of the exported item */
  name: string
  /** Whether it's a default export */
  isDefault: boolean
  /** Whether it's a re-export */
  isReexport: boolean
  /** Source module of re-exports */
  sourceModule: string | null
}

/**
 * Simplified module information for display
 */
interface SimplifiedModuleInfo {
  /** Module name */
  name: string
  /** Module description from JSDoc */
  description: string
  /** Module file name */
  fileName: string
  /** Simplified module imports */
  imports: SimplifiedImportInfo[]
  /** Simplified module exports */
  exports: SimplifiedExportInfo[]
}

/**
 * Specification of a module for the CLI interface
 */
interface ModuleSpec {
  /** Methods in the module */
  methods: Record<string, MethodInfo>
  /** Module metadata */
  module: {
    name: string
    description: string
    fileName: string
    imports: SimplifiedImportInfo[]
    exports: SimplifiedExportInfo[]
  }
}

/**
 * Represents a test mock scenario with its associated module and golden files
 */
interface MockScenario {
  /** Name of the module */
  moduleName: string
  /** Path to the module */
  modulePath: string
  /** Instance of the module */
  moduleInstance: unknown
  /** String representation of the module instance */
  moduleInstanceString: string
  /** Parsed module result as JSON */
  json: ParsedModuleResult
  /** Text representation */
  text: string
}

export type {
  AnalyzableFunction,
  ASTParserConfig,
  EnhancedMethodInfo,
  ExportInfo,
  ImportInfo,
  MethodInfo,
  MethodKind,
  MockScenario,
  ModuleInfo,
  ModuleSpec,
  ParamInfo,
  ParsedModuleResult,
  ReturnInfo,
  SimplifiedExportInfo,
  SimplifiedImportInfo,
  SimplifiedMethodInfo,
  SimplifiedModuleInfo,
  SimplifiedTypeInfo,
  TypeInfo,
  Visibility,
}

export { DEFAULT_AST_CONFIG }
