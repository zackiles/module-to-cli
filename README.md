# Module to CLI

[![JSR](https://jsr.io/badges/@deno-kit/module-to-cli)](https://jsr.io/@deno-kit/module-to-cli)
[![JSR Score](https://jsr.io/badges/@deno-kit/module-to-cli/score)](https://jsr.io/@deno-kit/module-to-cli)
[![JSR Scope](https://jsr.io/badges/@deno-kit)](https://jsr.io/@deno-kit)

> Invoke methods on a plain TypeScript file through your terminal

Module to CLI automatically generates a command-line interface for your TypeScript modules. It uses static analysis to detect exported functions, classes, and methods, making them accessible from the terminal with proper argument parsing and help menus.

## Installation

```bash
# Install from JSR
deno add @deno-kit/module-to-cli

# Or use directly via import
import moduleToCLI from "@deno-kit/module-to-cli";
```

## Quick Start

Let's say you have a TypeScript module like this:

```typescript
// math.ts
/**
 * A collection of math utilities
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Math class with various operations
 */
export class Calculator {
  /**
   * Multiplies two numbers
   * @param a First number
   * @param b Second number
   */
  multiply(a: number, b: number): number {
    return a * b;
  }
  
  /**
   * Raises a number to a power
   * @param base The base number
   * @param exponent The exponent
   */
  static power(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }
}
```

You can now run methods from this module:

```bash
# Run a top-level function
deno run -A @deno-kit/module-to-cli math.ts add --a=5 --b=3

# Run a static class method
deno run -A @deno-kit/module-to-cli math.ts Calculator.power --base=2 --exponent=8

# Run an instance method (with constructor arguments)
deno run -A @deno-kit/module-to-cli math.ts Calculator.multiply --a=6 --b=7 --constructor.any=value
```

## Full Usage

Below is an expanded example that demonstrates the full capability of the library:

```typescript
// util.ts
/**
 * Utility library with various helpers
 * @module Utilities
 */

/**
 * Formats a string with provided values
 * @param template String template with {placeholders}
 * @param values Values to inject into the template
 * @returns Formatted string
 */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/{(\w+)}/g, (_, key) => values[key] || '');
}

/**
 * HTTP client with various methods
 */
export class HttpClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  
  /**
   * Create a new HTTP client
   * @param baseUrl The base URL for all requests
   * @param headers Default headers to include
   */
  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.headers = headers;
  }
  
  /**
   * Send a GET request to the specified endpoint
   * @param endpoint The API endpoint
   * @param params Optional query parameters
   * @returns The response data
   */
  async get(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }
  
  /**
   * Create a pre-configured client
   * @param config Client configuration
   */
  static createClient(config: { url: string, timeout: number }): HttpClient {
    return new HttpClient(config.url, { 'Timeout': config.timeout.toString() });
  }
}
```

Now you can use the CLI to interact with these methods:

```bash
# Get help for the module
deno run -A @deno-kit/module-to-cli util.ts --help

# Format a string
deno run -A @deno-kit/module-to-cli util.ts format --template="Hello, {name}!" --values='{"name":"World"}'

# Create an HTTP client instance and call a method
deno run -A @deno-kit/module-to-cli util.ts HttpClient.get --endpoint="/api/users" --params='{"limit":"10"}' --constructor.baseUrl="https://api.example.com" --constructor.headers='{"Authorization":"Bearer token"}'

# Use a static method to create a client
deno run -A @deno-kit/module-to-cli util.ts HttpClient.createClient --config='{"url":"https://api.example.com", "timeout":5000}'
```

The CLI automatically:

- Parses arguments based on method signatures
- Converts string inputs to appropriate types (numbers, booleans, objects)
- Provides help text from JSDoc comments
- Handles both top-level functions and class methods
- Supports constructor arguments for instance methods

## Generate Mode

The library also provides a "generate" mode that outputs a JSON or text-based specification of a module:

```bash
# Generate a specification in text format
deno run -A @deno-kit/module-to-cli generate util.ts

# Generate a specification in JSON format
deno run -A @deno-kit/module-to-cli generate util.ts --json
```

> **Example outputs:** You can view sample outputs in [simple-module.golden.txt](https://github.com/zackiles/module-to-cli/blob/main/test/mocks/simple-module.golden.txt) (text format) and [simple-module.golden.jsonc](https://github.com/zackiles/module-to-cli/blob/main/test/mocks/simple-module.golden.jsonc) (JSON format).

This specification describes all exported functions, classes, methods, parameters, and return types found in the module. The schema represents what the library uses internally to create the CLI interface and help menus.

This feature is useful for:

- Testing that your module is correctly parsed
- Creating your own documentation
- Understanding the structure of a module
- Generating custom interfaces for your modules

## License

MIT
