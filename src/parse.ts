/**
 * @module parse
 * This module provides a type-safe parser for TypeScript/JavaScript modules.
 * It extracts information about exported functions, classes, and methods,
 * including their JSDoc comments and type information.
 *
 * @example
 * ```typescript
 * // Using ModuleToCLI
 * import { ModuleToCLI } from './parse-module.ts';
 *
 * async function parseModuleWithCLI() {
 *   const parser = new ModuleToCLI('./path/to/my-module.ts');
 *   const result = await parser.get();
 *
 *   // Process the parsed module information to generate CLI
 *   const { module, exports, methods } = result;
 *   // ... generate CLI from the parsed information
 * }
 * ```
 *
 * @see https://github.com/dsherret/ts-morph
 * @see https://github.com/syavorsky/comment-parser
 */

import commentParserDefault from 'comment-parser'
import { isAbsolute, join } from '@std/path'
import {
  ClassDeclaration,
  FunctionDeclaration,
  GetAccessorDeclaration,
  JSDoc,
  MethodDeclaration,
  Node,
  Project,
  PropertyDeclaration,
  SetAccessorDeclaration,
  SourceFile,
  SyntaxKind,
  VariableDeclaration,
  VariableStatement,
} from 'ts-morph'
import {
  ASTParserConfig,
  DEFAULT_AST_CONFIG,
  EnhancedMethodInfo,
  ExportInfo,
  ImportInfo,
  MethodInfo,
  MethodKind,
  ModuleInfo,
  ParamInfo,
  ParsedModuleResult,
  ReturnInfo,
  TypeInfo,
  Visibility,
} from './types.ts'

/**
 * A type-safe parser for TypeScript/JavaScript modules
 */
class ModuleParser {
  private filePath: string
  private project: Project
  private config: ASTParserConfig

  /**
   * Create a new ModuleParser
   * @param filePath Path to the module file
   * @param config Configuration options
   */
  constructor(filePath: string, config: Partial<ASTParserConfig> = {}) {
    this.filePath = filePath
    this.project = new Project({})
    this.config = { ...DEFAULT_AST_CONFIG, ...config }
  }

  /**
   * Parse a type string into a TypeInfo object
   */
  private parseType(typeString: string): TypeInfo {
    if (!typeString || !this.config.captureComplexTypes) {
      return {
        baseType: typeString || '',
        isOptional: false,
        isNullable: false,
        rawType: typeString || '',
      }
    }

    const isOptional = typeString.endsWith('?') ||
      typeString.includes('|undefined')
    const isNullable = typeString.includes('|null')

    // Clean the type string for further processing
    const cleanType = typeString
      .replace('?', '')
      .replace('|undefined', '')
      .replace('|null', '')
      .trim()

    // Handle special cases
    if (cleanType.includes('Promise<')) {
      const match = cleanType.match(/Promise<(.+)>/)
      if (match) {
        return {
          baseType: 'Promise',
          typeArguments: [this.parseType(match[1])],
          isOptional,
          isNullable,
          rawType: typeString,
        }
      }
    }

    // Handle array types (both T[] and Array<T>)
    if (cleanType.endsWith('[]')) {
      const elementType = cleanType.slice(0, -2)
      return {
        baseType: 'Array',
        typeArguments: [this.parseType(elementType)],
        isOptional,
        isNullable,
        rawType: typeString,
      }
    }

    if (cleanType.includes('Array<')) {
      const match = cleanType.match(/Array<(.+)>/)
      if (match) {
        return {
          baseType: 'Array',
          typeArguments: [this.parseType(match[1])],
          isOptional,
          isNullable,
          rawType: typeString,
        }
      }
    }

    // Handle generic types
    const genericMatch = cleanType.match(/(\w+)<(.+)>/)
    if (genericMatch) {
      const baseType = genericMatch[1]
      const argsString = genericMatch[2]
      // Simple splitting by comma - this doesn't handle nested generics perfectly
      // but works for most common cases
      const args = this.splitGenericArgs(argsString)

      return {
        baseType,
        typeArguments: args.map((arg) => this.parseType(arg)),
        isOptional,
        isNullable,
        rawType: typeString,
      }
    }

    // Handle tuple types
    if (cleanType.startsWith('[') && cleanType.endsWith(']')) {
      const innerContent = cleanType.slice(1, -1).trim()
      if (innerContent) {
        return {
          baseType: cleanType,
          isOptional,
          isNullable,
          rawType: typeString,
        }
      }
    }

    // Handle union types
    if (cleanType.includes('|')) {
      const types = cleanType.split('|').map((t) => t.trim())
      return {
        baseType: types[0] || '',
        unionTypes: types.map((t) => this.parseType(t)),
        isOptional,
        isNullable,
        rawType: typeString,
      }
    }

    // Handle intersection types
    if (cleanType.includes('&')) {
      const types = cleanType.split('&').map((t) => t.trim())
      return {
        baseType: types[0] || '',
        intersectionTypes: types.map((t) => this.parseType(t)),
        isOptional,
        isNullable,
        rawType: typeString,
      }
    }

    // Default case - simple type
    return {
      baseType: cleanType,
      isOptional,
      isNullable,
      rawType: typeString,
    }
  }

  /**
   * Split generic arguments while respecting nested generics
   */
  private splitGenericArgs(argsString: string): string[] {
    const result: string[] = []
    let currentArg = ''
    let depth = 0

    for (const char of argsString) {
      if (char === '<') depth++
      else if (char === '>') depth--
      else if (char === ',' && depth === 0) {
        result.push(currentArg.trim())
        currentArg = ''
        continue
      }

      currentArg += char
    }

    if (currentArg.trim()) {
      result.push(currentArg.trim())
    }

    return result
  }

  /**
   * Parse JSDoc comments from a node
   */
  private parseJSDoc(node: Node): {
    description: string
    tags: Array<
      { tag: string; name: string; type: string; description: string }
    >
  } {
    const jsDocs = node.getKindName() !== 'JSDoc'
      ? (node as unknown as { getJsDocs(): JSDoc[] }).getJsDocs?.() || []
      : [node as JSDoc]

    if (jsDocs.length === 0) {
      return { description: '', tags: [] }
    }

    const jsDocText = jsDocs[0].getText()

    try {
      // Use the parse function directly
      const parsed = commentParserDefault(jsDocText)

      if (!parsed || parsed.length === 0) {
        return { description: '', tags: [] }
      }

      // Skip module-level JSDoc
      if (parsed[0].tags.some((tag) => tag.tag === 'module')) {
        return { description: '', tags: [] }
      }

      // Process tags to extract type information
      const processedTags = parsed[0].tags.map((tag) => {
        // Extract type from curly braces for param tags
        if (tag.tag === 'param' && tag.type) {
          const typeMatch = tag.type.match(/\{([^}]+)\}/)
          const extractedType = typeMatch ? typeMatch[1] : tag.type

          return {
            tag: tag.tag,
            name: tag.name,
            type: extractedType,
            description: tag.description,
          }
        }

        // Extract return type
        if (tag.tag === 'returns' && tag.type) {
          const typeMatch = tag.type.match(/\{([^}]+)\}/)
          const extractedType = typeMatch ? typeMatch[1] : tag.type

          return {
            tag: tag.tag,
            name: '',
            type: extractedType,
            description: tag.description,
          }
        }

        return {
          tag: tag.tag,
          name: tag.name,
          type: tag.type || '',
          description: tag.description,
        }
      })

      return {
        description: parsed[0].description || '',
        tags: processedTags,
      }
    } catch (error) {
      return { description: '', tags: [] }
    }
  }

  /**
   * Extract parameter information from JSDoc
   */
  private extractParams(jsDoc: {
    description: string
    tags: Array<
      { tag: string; name: string; type: string; description: string }
    >
  }): {
    name: string
    type: TypeInfo
    description: string
    optional: boolean
  }[] {
    const paramTags = jsDoc.tags.filter((tag) => tag.tag === 'param')

    return paramTags.map((tag) => {
      const name = tag.name.replace(/^_/, '')
      const isOptional = tag.name.startsWith('_') ||
        tag.description.includes('(optional)')

      return {
        name,
        type: this.parseType(tag.type),
        description: tag.description,
        optional: isOptional,
      }
    })
  }

  /**
   * Extract return type information from JSDoc
   */
  private extractReturns(jsDoc: {
    description: string
    tags: Array<
      { tag: string; name: string; type: string; description: string }
    >
  }): { type: TypeInfo; description: string } | null {
    const returnTag = jsDoc.tags.find((tag) => tag.tag === 'returns')

    if (!returnTag || !returnTag.type) {
      return null
    }

    return {
      type: this.parseType(returnTag.type),
      description: returnTag.description || '',
    }
  }

  /**
   * Create a method info object factory
   */
  private createMethodInfo(
    name: string,
    description: string,
    params: {
      name: string
      type: TypeInfo
      description: string
      optional: boolean
    }[],
    returns: { type: TypeInfo; description: string } | null,
    methodKind: EnhancedMethodInfo['methodKind'],
    isAsync: boolean,
    visibility: 'public' | 'private' | 'protected' = 'public',
  ): EnhancedMethodInfo {
    return {
      name,
      description,
      params,
      returns,
      methodKind,
      isAsync,
      visibility,
    }
  }

  /**
   * Process a function declaration
   */
  private processFunctionDeclaration(
    declaration: FunctionDeclaration,
    methods: Record<string, EnhancedMethodInfo>,
    namePrefix?: string,
  ): void {
    const funcName = declaration.getName() || ''
    const name = namePrefix || funcName

    const jsDoc = this.parseJSDoc(declaration)
    const params = this.extractParams(jsDoc)
    const returns = this.extractReturns(jsDoc)

    const isAsync = declaration.isAsync()

    methods[name] = this.createMethodInfo(
      name,
      jsDoc.description,
      params,
      returns,
      'function',
      isAsync,
    )
  }

  /**
   * Process a variable declaration, which might be a function
   */
  private processVariableDeclaration(
    declaration: VariableDeclaration,
    methods: Record<string, EnhancedMethodInfo>,
    namePrefix?: string,
  ): void {
    const name = namePrefix || declaration.getName()

    const initializer = declaration.getInitializer()
    if (!initializer) return

    // Only process if it's an arrow function or function expression
    const text = initializer.getText()
    if (
      !text.includes('=>') &&
      !text.startsWith('function') &&
      !text.startsWith('async function')
    ) {
      return
    }

    const jsDoc = this.parseJSDoc(declaration)
    const params = this.extractParams(jsDoc)
    const returns = this.extractReturns(jsDoc)

    // Check if async arrow function
    const isAsync = initializer.getText().startsWith('async')

    methods[name] = this.createMethodInfo(
      name,
      jsDoc.description,
      params,
      returns,
      'function',
      isAsync,
    )
  }

  /**
   * Process a class declaration, including its methods and properties
   */
  private processClassDeclaration(
    declaration: ClassDeclaration,
    className: string,
    methods: Record<string, EnhancedMethodInfo>,
  ): void {
    // Process constructors
    const constructors = declaration.getConstructors()
    if (constructors.length > 0) {
      const constructor = constructors[0]
      const jsDoc = this.parseJSDoc(constructor)
      const params = this.extractParams(jsDoc)

      methods[`${className}.constructor`] = this.createMethodInfo(
        `${className}.constructor`,
        jsDoc.description,
        params,
        null,
        'constructor',
        false,
      )
    }

    // Process instance methods
    if (this.config.captureInstanceMethods) {
      declaration.getMethods().forEach((method) => {
        // Skip methods that are static as they'll be handled separately
        if (method.isStatic()) return

        // Determine visibility based on modifiers
        let visibility: 'public' | 'private' | 'protected' = 'public'
        if (method.hasModifier(SyntaxKind.PrivateKeyword)) {
          visibility = 'private'
        }
        if (method.hasModifier(SyntaxKind.ProtectedKeyword)) {
          visibility = 'protected'
        }

        this.processMethod(method, className, methods, 'instance', visibility)
      })
    }

    // Process static methods
    if (this.config.captureStaticMethods) {
      declaration.getStaticMethods().forEach((method) => {
        // Determine visibility based on modifiers
        let visibility: 'public' | 'private' | 'protected' = 'public'
        if (method.hasModifier(SyntaxKind.PrivateKeyword)) {
          visibility = 'private'
        }
        if (method.hasModifier(SyntaxKind.ProtectedKeyword)) {
          visibility = 'protected'
        }

        this.processMethod(method, className, methods, 'static', visibility)
      })
    }

    // Process property methods (including arrow functions)
    if (this.config.capturePropertyMethods) {
      declaration.getProperties().forEach((property) => {
        const initializer = property.getInitializer()
        if (!initializer) return

        const initializerText = initializer.getText()
        if (
          initializerText.includes('=>') || initializerText.includes('function')
        ) {
          this.processPropertyMethod(property, className, methods)
        }
      })
    }

    // Process getters
    if (this.config.captureGetAccessors) {
      declaration.getGetAccessors().forEach((getter) => {
        this.processAccessor(getter, className, methods, 'getter')
      })
    }

    // Process setters
    if (this.config.captureSetAccessors) {
      declaration.getSetAccessors().forEach((setter) => {
        this.processAccessor(setter, className, methods, 'setter')
      })
    }
  }

  /**
   * Process a method declaration
   */
  private processMethod(
    method: MethodDeclaration,
    className: string,
    methods: Record<string, EnhancedMethodInfo>,
    methodKind: 'instance' | 'static',
    visibility: 'public' | 'private' | 'protected' = 'public',
  ): void {
    const name = method.getName()
    const fullName = `${className}.${name}`
    const jsDoc = this.parseJSDoc(method)
    const params = this.extractParams(jsDoc)
    const returns = this.extractReturns(jsDoc)
    const isAsync = method.isAsync()

    methods[fullName] = this.createMethodInfo(
      fullName,
      jsDoc.description,
      params,
      returns,
      methodKind,
      isAsync,
      visibility,
    )
  }

  /**
   * Process a property that is a method (e.g., arrow function)
   */
  private processPropertyMethod(
    property: PropertyDeclaration,
    className: string,
    methods: Record<string, EnhancedMethodInfo>,
  ): void {
    const name = property.getName()
    const fullName = `${className}.${name}`
    const jsDoc = this.parseJSDoc(property)
    const params = this.extractParams(jsDoc)
    const returns = this.extractReturns(jsDoc)

    // Check if async arrow function
    const initializer = property.getInitializer()
    const isAsync = initializer?.getText().startsWith('async') || false

    // Determine visibility
    let visibility: 'public' | 'private' | 'protected' = 'public'
    if (property.hasModifier(SyntaxKind.PrivateKeyword)) visibility = 'private'
    if (property.hasModifier(SyntaxKind.ProtectedKeyword)) {
      visibility = 'protected'
    }

    methods[fullName] = this.createMethodInfo(
      fullName,
      jsDoc.description,
      params,
      returns,
      'property',
      isAsync,
      visibility,
    )
  }

  /**
   * Process a getter or setter
   */
  private processAccessor(
    accessor: GetAccessorDeclaration | SetAccessorDeclaration,
    className: string,
    methods: Record<string, EnhancedMethodInfo>,
    methodKind: 'getter' | 'setter',
  ): void {
    const name = accessor.getName()
    const fullName = `${className}.${name}`
    const jsDoc = this.parseJSDoc(accessor)

    let params: {
      name: string
      type: TypeInfo
      description: string
      optional: boolean
    }[] = []

    // For setters, get the parameter from the first parameter
    if (methodKind === 'setter') {
      const parameters = accessor.getParameters()
      if (parameters.length > 0) {
        const param = parameters[0]
        const paramName = param.getName() || 'value' // Default to 'value' if name is undefined
        const paramType = param.getType().getText()

        const paramDescription = jsDoc.tags.find((t) =>
          t.tag === 'param' && t.name === paramName
        )?.description || ''

        params = [{
          name: paramName,
          type: this.parseType(paramType),
          description: paramDescription,
          optional: false,
        }]
      }
    }

    // Getters have return types, setters don't
    const returns = methodKind === 'getter' ? this.extractReturns(jsDoc) : null

    // Determine visibility
    let visibility: 'public' | 'private' | 'protected' = 'public'
    if (accessor.hasModifier(SyntaxKind.PrivateKeyword)) visibility = 'private'
    if (accessor.hasModifier(SyntaxKind.ProtectedKeyword)) {
      visibility = 'protected'
    }

    methods[fullName] = this.createMethodInfo(
      fullName,
      jsDoc.description,
      params,
      returns,
      methodKind,
      false,
      visibility,
    )
  }

  /**
   * Process a namespace declaration, including its functions, classes, and variables
   */
  private processNamespaceDeclaration(
    namespace: Node,
    namespaceName: string,
    methods: Record<string, EnhancedMethodInfo>,
  ): void {
    const body = namespace.getFirstDescendantByKind(SyntaxKind.ModuleBlock)
    if (!body) return

    // Process exported functions
    const functions = body.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
    for (const funcNode of functions) {
      // Safe type cast
      try {
        // Need to access properties in a type-safe way
        const isExported =
          funcNode.getFirstDescendantByKind(SyntaxKind.ExportKeyword) !==
            undefined
        if (isExported) {
          const nameIdentifier = funcNode.getFirstDescendantByKind(
            SyntaxKind.Identifier,
          )
          const funcName = nameIdentifier ? nameIdentifier.getText() : ''

          this.processFunctionDeclaration(
            funcNode as FunctionDeclaration,
            methods,
            `${namespaceName}.${funcName}`,
          )
        }
      } catch (err) {
        // No-op
      }
    }

    // Process exported classes
    const classes = body.getDescendantsOfKind(SyntaxKind.ClassDeclaration)
    for (const clsNode of classes) {
      try {
        const isExported =
          clsNode.getFirstDescendantByKind(SyntaxKind.ExportKeyword) !==
            undefined
        if (isExported) {
          const nameIdentifier = clsNode.getFirstDescendantByKind(
            SyntaxKind.Identifier,
          )
          const className = nameIdentifier ? nameIdentifier.getText() : ''

          this.processClassDeclaration(
            clsNode as ClassDeclaration,
            `${namespaceName}.${className}`,
            methods,
          )
        }
      } catch (err) {
        // No-op
      }
    }

    // Process exported variable declarations
    const variableStatements = body.getDescendantsOfKind(
      SyntaxKind.VariableStatement,
    )
    for (const stmtNode of variableStatements) {
      try {
        const isExported =
          stmtNode.getFirstDescendantByKind(SyntaxKind.ExportKeyword) !==
            undefined
        if (isExported) {
          const statement = stmtNode as VariableStatement
          const declarations = statement.getFirstDescendantByKind(
            SyntaxKind.VariableDeclarationList,
          )?.getChildrenOfKind(SyntaxKind.VariableDeclaration) || []

          for (const declaration of declarations) {
            const nameIdentifier = declaration.getFirstDescendantByKind(
              SyntaxKind.Identifier,
            )
            const varName = nameIdentifier ? nameIdentifier.getText() : ''

            this.processVariableDeclaration(
              declaration as VariableDeclaration,
              methods,
              `${namespaceName}.${varName}`,
            )
          }
        }
      } catch (err) {
        // No-op
      }
    }

    // Process nested namespaces recursively
    const nestedNamespaces = body.getDescendantsOfKind(
      SyntaxKind.ModuleDeclaration,
    )
    for (const nestedNode of nestedNamespaces) {
      try {
        const isExported =
          nestedNode.getFirstDescendantByKind(SyntaxKind.ExportKeyword) !==
            undefined
        if (isExported) {
          const nameIdentifier = nestedNode.getFirstDescendantByKind(
            SyntaxKind.Identifier,
          )
          const nestedName = nameIdentifier ? nameIdentifier.getText() : ''

          const prefixedNamespaceName = `${namespaceName}.${nestedName}`
          this.processNamespaceDeclaration(
            nestedNode,
            prefixedNamespaceName,
            methods,
          )
        }
      } catch (err) {
        // No-op
      }
    }
  }

  /**
   * Parse the module file and extract method information
   */
  async parse(): Promise<ParsedModuleResult> {
    try {
      // Resolve the file path
      let absolutePath = this.filePath
      if (!isAbsolute(absolutePath)) {
        absolutePath = join(Deno.cwd(), absolutePath)
      }

      // Read the file content
      const fileContent = await Deno.readTextFile(absolutePath)

      // Create a source file in the project
      const sourceFile = this.project.createSourceFile('temp.ts', fileContent)

      return this.parseSourceFile(sourceFile)
    } catch (error) {
      throw error
    }
  }

  /**
   * Parse a source file and extract method information
   */
  private parseSourceFile(
    sourceFile: SourceFile,
  ): ParsedModuleResult {
    const methods: Record<string, EnhancedMethodInfo> = {}

    // Process functions
    sourceFile.getFunctions().forEach((func) => {
      if (func.isExported()) {
        this.processFunctionDeclaration(func, methods)
      }
    })

    // Process classes
    sourceFile.getClasses().forEach((cls) => {
      if (cls.isExported()) {
        const className = cls.getName() || ''
        this.processClassDeclaration(cls, className, methods)
      }
    })

    // Process variable declarations
    sourceFile.getVariableDeclarations().forEach((declaration) => {
      if (declaration.isExported()) {
        this.processVariableDeclaration(declaration, methods)
      }
    })

    // Process namespaces
    const namespaces = sourceFile.getDescendantsOfKind(
      SyntaxKind.ModuleDeclaration,
    )
    for (const namespaceNode of namespaces) {
      try {
        const isExported =
          namespaceNode.getFirstDescendantByKind(SyntaxKind.ExportKeyword) !==
            undefined
        if (isExported) {
          const nameIdentifier = namespaceNode.getFirstDescendantByKind(
            SyntaxKind.Identifier,
          )
          const namespaceName = nameIdentifier ? nameIdentifier.getText() : ''

          this.processNamespaceDeclaration(
            namespaceNode,
            namespaceName,
            methods,
          )
        }
      } catch (err) {
        // No-op
      }
    }

    // Extract module information
    const moduleInfo = this.extractModuleInfo(sourceFile)

    return {
      methods,
      module: moduleInfo,
    }
  }

  /**
   * Extract module information from source file JSDoc comments
   */
  private extractModuleInfo(sourceFile: SourceFile): ModuleInfo {
    const fileName = sourceFile.getBaseName()
    let name = fileName.replace(/\.(ts|js|tsx|jsx)$/, '')
    let description = ''

    // Extract module information from JSDoc
    const jsDocs = sourceFile.getChildrenOfKind(SyntaxKind.JSDocComment)
    for (const jsDoc of jsDocs) {
      const jsDocText = jsDoc.getText()

      // Parse the JSDoc to extract module information
      try {
        // Use the imported comment parser
        const parsedComments = commentParserDefault(jsDocText)
        if (parsedComments && parsedComments.length > 0) {
          const parsedComment = parsedComments[0]

          // Get module name from @module tag if it exists
          const moduleTag = parsedComment.tags.find((tag: { tag: string }) =>
            tag.tag === 'module'
          )
          if (moduleTag && moduleTag.name) {
            name = moduleTag.name
          }

          // Get description
          description = parsedComment.description
        }
      } catch (err) {
        // No-op
      }
    }

    const imports = this.extractImports(sourceFile)
    const exports = this.extractExports(sourceFile)

    return {
      name,
      description,
      fileName,
      imports,
      exports,
    }
  }

  /**
   * Extract import information from source file
   */
  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = []

    sourceFile.getImportDeclarations().forEach((importDecl) => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()
      const defaultImport = importDecl.getDefaultImport()?.getText() || ''
      const namespaceImport = importDecl.getNamespaceImport()?.getText() || ''

      const namedImports = importDecl.getNamedImports().map((named) =>
        named.getName()
      )

      imports.push({
        moduleName: moduleSpecifier,
        isDefault: !!defaultImport,
        isNamespace: !!namespaceImport,
        namedImports,
      })
    })

    return imports
  }

  /**
   * Extract export information from source file
   */
  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = []

    // Get export declarations
    sourceFile.getExportDeclarations().forEach((exportDecl) => {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue()
      const isReexport = !!moduleSpecifier

      const namedExports = exportDecl.getNamedExports()

      if (namedExports.length > 0) {
        namedExports.forEach((named) => {
          exports.push({
            name: named.getName(),
            isDefault: false,
            isReexport,
            sourceModule: moduleSpecifier || undefined,
          })
        })
      } else {
        // Check if it's a default export
        const defaultKeyword = exportDecl.getFirstDescendantByKind(
          SyntaxKind.DefaultKeyword,
        )
        if (defaultKeyword) {
          exports.push({
            name: 'default',
            isDefault: true,
            isReexport: isReexport,
            sourceModule: moduleSpecifier || undefined,
          })
        }
      }
    })

    // Handle export assignments (export = X or export default X)
    sourceFile.getExportAssignments().forEach((exportAssign) => {
      const isDefault = exportAssign.isExportEquals() ? false : true
      const expression = exportAssign.getExpression()
      const expressionText = expression.getText()

      exports.push({
        name: expressionText,
        isDefault,
        isReexport: false,
      })
    })

    // Handle exported variables, functions, classes, etc.
    const exportedDeclarations = sourceFile.getExportedDeclarations()
    exportedDeclarations.forEach((declarations, key) => {
      // key is string in ts-morph 5+
      const keyStr = String(key)
      exports.push({
        name: keyStr,
        isDefault: keyStr === 'default',
        isReexport: false,
      })
    })

    return exports
  }
}

class ModuleToCLI extends ModuleParser {
  constructor(filePath: string, config: Partial<ASTParserConfig> = {}) {
    super(filePath, config)
  }

  get(): Promise<ParsedModuleResult> {
    return this.parse()
  }
}

export { ModuleToCLI }
