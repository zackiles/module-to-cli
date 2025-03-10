/**
 * @module print
 * @description Utility functions for formatting and displaying module information in the console
 */

import {
  blue,
  bold,
  cyan,
  dim,
  green,
  magenta,
  red,
  stripAnsiCode,
  white,
  yellow,
} from '@std/fmt/colors'
import { parse as JSONCParse } from '@std/jsonc'
import {
  EnhancedMethodInfo,
  MethodInfo,
  ModuleInfo,
  ModuleSpec,
  SimplifiedMethodInfo,
  SimplifiedModuleInfo,
  TypeInfo,
} from './types.ts'

//Deno.env.set('SHOULD_FORMAT', '1')
const shouldFormat = Deno.env.has('SHOULD_FORMAT')

/**
 * Print messages to the console and if shouldFormat = false it strips any of the ANSI
 * characters that "@std/fmt/colors" might've added.
 * @param args - Any number of arguments to be logged
 */
function print(...args: unknown[]): void {
  if (shouldFormat) {
    console.log(...args)
  } else {
    const processedArgs = args.map((arg) =>
      typeof arg === 'string' ? stripAnsiCode(arg) : arg
    )
    console.log(...processedArgs)
  }
}

/**
 * Convert enhanced method info type to a simplified format for display
 */
function printSimpleMethodInfo(
  methods: Record<string, EnhancedMethodInfo>,
): Record<string, SimplifiedMethodInfo> {
  return Object.entries(methods).reduce((simplified, [key, method]) => {
    simplified[key] = {
      name: method.name,
      params: method.params.map(({ name, type, description, optional }) => ({
        name,
        type: type.rawType,
        description,
        optional,
      })),
      description: method.description,
      returns: method.returns
        ? {
          type: method.returns.type.rawType,
          description: method.returns.description,
        }
        : null,
      methodKind: method.methodKind,
    }
    return simplified
  }, {} as Record<string, SimplifiedMethodInfo>)
}

/**
 * Format the methods for pretty printing
 */
function printModuleMethods(
  methods: Record<string, EnhancedMethodInfo>,
  useSimpleFormat: boolean,
): void {
  const divider = '═'.repeat(60)

  print(bold(cyan('\n🚀 Module Methods')))
  print(dim(divider))
  print(dim('Detailed Method Information'))

  for (const [name, info] of Object.entries(methods)) {
    print(`\n${bold(yellow(`📄 ${name}`))}`)
    print(dim('  ' + '─'.repeat(40)))

    const kindStr = info.methodKind.charAt(0).toUpperCase() +
      info.methodKind.slice(1)
    print(
      `  ${bold(`[${kindStr} Method]`)} ${
        dim(`[${info.visibility}]${info.isAsync ? ' [async]' : ''}`)
      }`,
    )

    if (info.description) {
      print(`  ${white(info.description)}\n`)
    }

    if (info.params.length > 0) {
      print(`  ${bold(magenta('⚙️ Parameters:'))}`)
      for (const param of info.params) {
        const optionalMark = param.optional ? ' (optional)' : ''
        const typeStr = useSimpleFormat
          ? param.type.rawType
          : printTypeInfo(param.type)
        print(`    ${bold(param.name)}: ${dim(typeStr)}${optionalMark}`)
        if (param.description) {
          print(`      ${white(param.description)}`)
        }
      }
    } else {
      print(`  ${bold(magenta('⚙️ Parameters:'))} ${dim('none')}`)
    }

    if (info.returns) {
      print(`\n  ${bold(green('📋 Returns:'))}`)
      const typeStr = useSimpleFormat
        ? info.returns.type.rawType
        : printTypeInfo(info.returns.type)
      print(`    ${dim(typeStr)}`)
      if (info.returns.description) {
        print(`    ${white(info.returns.description)}`)
      }
    } else if (
      info.methodKind !== 'constructor' && info.methodKind !== 'setter'
    ) {
      print(`\n  ${bold(green('📋 Returns:'))} ${dim('void')}`)
    }
  }

  print(dim('\n' + divider))
}

/**
 * Format a TypeInfo object for display
 */
function printTypeInfo(typeInfo: TypeInfo): string {
  if (!typeInfo) return 'unknown'

  if (typeInfo.rawType) {
    return typeInfo.rawType
  }

  const {
    baseType = '',
    typeArguments = [],
    unionTypes = [],
    intersectionTypes = [],
    isOptional,
    isNullable,
  } = typeInfo

  let result = baseType

  if (typeArguments.length > 0) {
    result += `<${typeArguments.map(printTypeInfo).join(', ')}>`
  }

  if (unionTypes.length > 0) {
    result = unionTypes.map(printTypeInfo).join(' | ')
  }

  if (intersectionTypes.length > 0) {
    result = intersectionTypes.map(printTypeInfo).join(' & ')
  }

  return `${result}${isOptional ? ' | undefined' : ''}${
    isNullable ? ' | null' : ''
  }`
}

/**
 * Format module metadata for pretty printing
 */
function printModuleInfo(
  moduleInfo: ModuleInfo,
  useSimpleFormat: boolean,
): void {
  print('Module Information:')
  print('==================\n')

  print(`Name: ${moduleInfo.name}`)
  print(`File: ${moduleInfo.fileName}`)

  if (moduleInfo.description) {
    print(`\nDescription:`)
    print(`${moduleInfo.description}\n`)
  }

  if (moduleInfo.imports.length > 0) {
    print('Imports:')
    for (const imp of moduleInfo.imports) {
      const importStr = useSimpleFormat
        ? `  - ${imp.moduleName}${imp.isDefault ? ' (default)' : ''}`
        : `  - ${imp.moduleName}${imp.isDefault ? ' (default import)' : ''}${
          imp.isNamespace ? ' (namespace import)' : ''
        }${
          imp.namedImports.length > 0 ? `: ${imp.namedImports.join(', ')}` : ''
        }`

      print(importStr)
    }
    print('')
  }

  if (moduleInfo.exports.length > 0) {
    print('Exports:')
    for (const exp of moduleInfo.exports) {
      const exportStr = useSimpleFormat
        ? `  - ${exp.name}${exp.isDefault ? ' (default)' : ''}`
        : `  - ${exp.name}${exp.isDefault ? ' (default export)' : ''}${
          (exp.isReexport && exp.sourceModule)
            ? ` from "${exp.sourceModule}"`
            : ''
        }`

      print(exportStr)
    }
    print('')
  }
}

/**
 * Convert module info to a simplified format for display
 */
function printSimpleModuleInfo(
  moduleInfo: ModuleInfo,
): SimplifiedModuleInfo {
  const { name, description, fileName, imports, exports } = moduleInfo

  return {
    name,
    description,
    fileName,
    imports: imports.map((
      { moduleName, isDefault, isNamespace, namedImports },
    ) => ({
      module: moduleName,
      isDefault,
      isNamespace,
      namedImports,
    })),
    exports: exports.map(({ name, isDefault, isReexport, sourceModule }) => ({
      name,
      isDefault,
      isReexport,
      sourceModule: sourceModule ?? null,
    })),
  }
}

/**
 * Displays help information for available methods
 */
function printMenuForModule(spec: ModuleSpec): void {
  const { nameVersion, name } = getPackageInfo()
  const divider = '═'.repeat(60)

  print(bold(cyan(`\n🚀 ${nameVersion}`)))
  print(dim(divider))
  print(dim('Module Methods Browser'))

  print(`\n${bold(yellow('📄 Module:'))}`)
  print(`  ${white(spec.module.name)}`)
  if (spec.module.description) {
    print(`  ${white(spec.module.description)}`)
  }

  print(`\n${bold(magenta('⚙️ Available Methods:'))}`)

  const methodsByClass = Object.entries(spec.methods)
    .filter(([, method]) => method.visibility === 'public')
    .reduce((acc, [key, method]) => {
      const className = key.includes('.')
        ? key.split('.')[0]
        : 'Global Functions'
      if (!acc[className]) acc[className] = []
      acc[className].push(method)
      return acc
    }, {} as Record<string, MethodInfo[]>)

  for (const [className, methods] of Object.entries(methodsByClass)) {
    print(`\n${bold(green(`📋 ${className}`))}`)
    print(
      dim(
        `${
          className === 'Global Functions'
            ? 'Global Functions:'
            : `${className}:`
        }`,
      ),
    )
    print(dim('  ' + '─'.repeat(40)))

    for (const method of methods) {
      const name = method.name.includes('.')
        ? method.name.split('.').slice(1).join('.')
        : method.name

      const paramStr = method.params.map((p) =>
        `${p.name}${p.optional ? '?' : ''}: ${dim(p.type.rawType)}`
      ).join(', ')

      const returnType = method.returns?.type.rawType || 'void'
      print(`  ${bold(yellow(name))}(${paramStr}) => ${dim(returnType)}`)

      if (method.description) {
        print(`    ${white(method.description)}`)
      }

      if (method.params.length > 0) {
        print(`    ${bold('Parameters:')}`)
        for (const param of method.params) {
          const description = param.description
            ? white(param.description)
            : dim(param.type.rawType)
          print(
            `      ${bold(param.name)}${
              param.optional ? '?' : ''
            }: ${description}`,
          )
        }
      }
    }
  }

  print(dim('\n' + divider))
}

/**
 * Gets library name, version and description from deno.jsonc
 */
function getPackageInfo() {
  const defaults = {
    name: 'module-to-cli',
    version: '0.0.0',
    description:
      'A dynamic CLI tool that provides command-line access to any TypeScript module',
  }

  try {
    const configPath = new URL('../deno.jsonc', import.meta.url)
    const config = JSONCParse(Deno.readTextFileSync(configPath))

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {
        nameVersion: `${defaults.name} - ${defaults.version}`,
        ...defaults,
      }
    }

    const {
      name = defaults.name,
      version = defaults.version,
      description = defaults.description,
    } = config as Record<string, string>

    return {
      nameVersion: `${name} - ${version}`,
      name,
      description,
    }
  } catch {
    return {
      nameVersion: `${defaults.name} - ${defaults.version}`,
      ...defaults,
    }
  }
}

/**
 * Displays general help information for the CLI
 */
function printMenu(): void {
  const { nameVersion, description, name } = getPackageInfo()
  const divider = '═'.repeat(60)

  print(bold(cyan(`\n🚀 ${nameVersion}`)))
  print(dim(divider))

  print(`\n${bold(yellow('📄 Description:'))}`)
  print(`  ${white(description)}`)

  print(`\n${green('📋 Usage:')}`)
  print(
    `  ${`./${name}`} ${bold('path/to/module.ts')} ${
      bold(dim('[method-name] [options]'))
    }`,
  )
  print(
    `  ${`./${name}`} ${bold('generate')} ${
      bold(dim('path/to/module.ts [options]'))
    } ${dim('(specification generator mode)')}`,
  )

  print(`\n${bold(blue('📝 Examples:'))}`)

  print(`
  ${bold('# List all available methods')}
  ${`./${name}`} ${bold('path/to/module.ts')}

  ${bold('# Call a function with arguments')}
  ${`./${name}`} ${bold('path/to/module.ts')} ${bold('functionName')} ${
    dim('--arg1=value --arg2=value')
  }

  ${bold('# Call a method in a class with constructor arguments')}
  ${`./${name}`} ${bold('path/to/module.ts')} ${bold('ClassName.methodName')} ${
    dim('--arg1=value --constructor.arg1=value')
  }
  
  ${bold('# Generate a specification for a module')}
  ${`./${name}`} ${bold('generate')} ${bold('path/to/module.ts')} ${
    dim('--json --simple')
  }
  `)

  print(`${bold(magenta('⚙️ Options:'))}`)
  print(
    `  ${bold('--help')}, ${bold('-h')}     ${white('Show this help message')}`,
  )
  print(
    `  ${bold('generate')}        ${
      white(
        'Run in specification generator mode (use with --help for more options)',
      )
    }`,
  )

  print(dim('\n' + divider))
}

/**
 * Handles errors with appropriate messaging
 */
function printError(message: string, error: unknown): void {
  print(red(`\n❌ ${bold('Error:')}`))
  print(red(`  ${message}`))
  if (error) {
    print(dim(typeof error === 'string' ? error : String(error)))
  }
  print(dim('═'.repeat(60)))
}

/**
 * Displays help information for the module specification generator
 */
function printMenuForSpecificationGenerator(): void {
  const { nameVersion, description, name } = getPackageInfo()
  const divider = '═'.repeat(60)
  const execName = name.split('/').pop()

  print(bold(cyan(`\n🚀 ${nameVersion}`)))
  print(dim(divider))
  print(dim('Module Specification Generator'))

  print(`\n${bold(yellow('📄 Description:'))}`)
  print(
    `  ${
      white(
        'Generates a complete specification given a Typescript module that includes all exported methods, classes, types, and their documentation.',
      )
    }`,
  )

  print(`\n${green('📋 Usage:')}`)
  print(
    `  ${`./${execName}`} ${bold('path/to/module.ts')} ${
      bold(dim('[options]'))
    }`,
  )

  print(`\n${bold(magenta('⚙️ Options:'))}
  ${bold('--help')}, ${bold('-h')}     ${white('Show this help message')}
  ${bold('--json')}, ${bold('-j')}     ${
    white('Output as JSON (Default is text)')
  }
  ${bold('--simple')}, ${bold('-s')}   ${
    white('Return a simplified list of exported methods')
  }
  `)

  print(dim('\n' + divider))
}

export {
  print,
  printError,
  printMenu,
  printMenuForModule,
  printMenuForSpecificationGenerator,
  printModuleInfo,
  printModuleMethods,
  printSimpleMethodInfo,
  printSimpleModuleInfo,
  printTypeInfo,
}
