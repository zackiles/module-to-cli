import { dirname, fromFileUrl, join } from '@std/path'


interface TestSetupConfig {
  MOCKS_PATH?: string
  CLI_PATH?: string,
  CURRENT_PATH?: string
}

export function testSetup(config: TestSetupConfig = {}) {
  const CURRENT_PATH = config.CURRENT_PATH || dirname(fromFileUrl(import.meta.url))
  Deno.env.set('CURRENT_PATH', CURRENT_PATH)
  
  const MOCKS_PATH = config.MOCKS_PATH || join(dirname(CURRENT_PATH), 'mocks')
  Deno.env.set('MOCKS_PATH', MOCKS_PATH)
  
  const WORKSPACE_PATH = import.meta.url ? new URL('../..', import.meta.url).pathname : Deno.cwd()
  Deno.env.set('WORKSPACE_PATH', WORKSPACE_PATH)
  Deno.env.set('CLI_PATH', config.CLI_PATH || join(WORKSPACE_PATH, 'src', 'main.ts'))
  
  Deno.env.set('DENO_ENV', 'test')
} 
