/**
 * Tests for drizzle/schema.ts focusing on:
 * - Environment-based schema selection (ENV_NOTE vs helperVariable.schemaName)
 * - bytea customType conversions (toDriver/fromDriver)
 *
 * Testing library and framework: Jest (ts-jest or Babel transpilation assumed).
 * If this project uses Vitest instead, these tests are compatible with Vitest's Jest-like API.
 */

import path from 'path'

// We'll mock the pg-core to intercept pgSchema/customType usage
let capturedPgSchemaArgs: string[] = []
let capturedCustomTypeConfig: any | null = null

jest.mock('drizzle-orm/pg-core', () => {
  const original = jest.requireActual ? jest.requireActual('drizzle-orm/pg-core') : {}
  return {
    __esModule: true,
    // Mock pgSchema to capture argument and return a recognizable object
    pgSchema: (name: string) => {
      capturedPgSchemaArgs.push(name)
      return { __mockedPgSchema: true, name }
    },
    // Wrap customType to capture config so tests can call toDriver/fromDriver
    customType: <T extends any>(config: any) => {
      capturedCustomTypeConfig = config
      return {
        // Provide minimal shape; drizzle would normally use this type wrapper
        // We expose config methods to let tests call directly
        __mockedCustomType: true,
        config,
      } as any
    },
    // Re-export anything else if necessary
    ...original,
  }
})

// Helper to reset module state between tests
const resetIsolatedModule = async () => {
  jest.resetModules()
  capturedPgSchemaArgs = []
  capturedCustomTypeConfig = null
}

// Helper to import the schema module fresh with given ENV
const importSchemaWithEnv = async (envNote: string | undefined) => {
  await resetIsolatedModule()
  if (typeof envNote === 'undefined') {
    delete (process.env as any).ENV_NOTE
  } else {
    process.env.ENV_NOTE = envNote
  }
  // Import helperVariable so it is evaluated consistently with the schema
  // and the schema module under test.
  const schemaModulePath = path.posix.join(process.cwd().replace(/\\/g, '/'), 'drizzle', 'schema.ts')
  // Use dynamic import via ts-node/jest transpilation; path resolution depends on test env's module resolver.
  // Prefer requiring by relative path from test file for portability.
  try {
    await import('./schema.ts')
  } catch (e) {
    // If TypeScript path alias or extension-less import is necessary, fall back to compiled JS if available
    try {
      await import('./schema')
    } catch {
      // As a last resort, require via CommonJS require which also respects ts-jest transpilation
      require('./schema.ts')
    }
  }
}

describe('drizzle/schema - environment-based schema selection', () => {
  test('uses helperVariable.schemaName when ENV_NOTE matches exactly', async () => {
    await resetIsolatedModule()
    // Lazily import helper module to read expected schemaName
    // We do not mock '../src/constants/helper' to avoid masking real value.
    let expectedName = undefined as any
    try {
      const { helperVariable } = await import('../src/constants/helper')
      expectedName = helperVariable.schemaName
    } catch {
      // If helper not importable under tests, assume canonical name "notes" used in typical setups
      expectedName = 'notes'
    }

    await importSchemaWithEnv(expectedName)

    expect(capturedPgSchemaArgs.length).toBeGreaterThan(0)
    expect(capturedPgSchemaArgs[0]).toBe(expectedName)
  })

  test('falls back to "main" schema when ENV_NOTE is different or unset', async () => {
    await importSchemaWithEnv(undefined)
    expect(capturedPgSchemaArgs.length).toBeGreaterThan(0)
    expect(capturedPgSchemaArgs[0]).toBe('main')

    await importSchemaWithEnv('some-other-schema')
    expect(capturedPgSchemaArgs[capturedPgSchemaArgs.length - 1]).toBe('main')
  })
})

describe('drizzle/schema - bytea customType conversion', () => {
  const callToDriver = (hex: string) => {
    if (!capturedCustomTypeConfig) throw new Error('customType config not captured; schema module may not have been imported')
    return capturedCustomTypeConfig.toDriver(hex)
  }
  const callFromDriver = (buf: Buffer) => {
    if (!capturedCustomTypeConfig) throw new Error('customType config not captured; schema module may not have been imported')
    return capturedCustomTypeConfig.fromDriver(buf)
  }

  beforeAll(async () => {
    // Ensure schema is imported at least once to register customType
    await importSchemaWithEnv('main')
    expect(capturedCustomTypeConfig).toBeTruthy()
    expect(typeof capturedCustomTypeConfig.toDriver).toBe('function')
    expect(typeof capturedCustomTypeConfig.fromDriver).toBe('function')
    // dataType should be 'bytea'
    expect(capturedCustomTypeConfig.dataType()).toBe('bytea')
  })

  test('toDriver returns Buffer from plain hex string (no 0x prefix)', () => {
    const input = 'deadbeef'
    const out: Buffer = callToDriver(input)
    expect(Buffer.isBuffer(out)).toBe(true)
    expect(out.toString('hex')).toBe('deadbeef')
  })

  test('toDriver strips 0x prefix before decoding', () => {
    const input = '0x0123ABcd'
    const out: Buffer = callToDriver(input)
    expect(out.toString('hex')).toBe('0123abcd') // lowercased hex after Buffer.toString('hex')
  })

  test('toDriver handles empty string producing empty Buffer', () => {
    const input = ''
    const out: Buffer = callToDriver(input)
    expect(out.equals(Buffer.alloc(0))).toBe(true)
  })

  test('fromDriver encodes Buffer to lowercase hex string', () => {
    const buf = Buffer.from('A1B2c3', 'hex')
    const hex = callFromDriver(buf)
    expect(hex).toBe('a1b2c3')
  })

  test('roundtrip: hex -> Buffer -> hex (no 0x prefix) yields normalized lowercase', () => {
    const input = 'DEADBEEF'
    const buf = callToDriver(input)
    const round = callFromDriver(buf)
    expect(round).toBe('deadbeef')
  })

  test('roundtrip: 0x-prefixed hex normalizes correctly', () => {
    const input = '0xDEADBEEF'
    const buf = callToDriver(input)
    const round = callFromDriver(buf)
    expect(round).toBe('deadbeef')
  })

  test('toDriver throws for non-hex strings', () => {
    // Buffer.from(str, 'hex') throws if invalid length or non-hex chars
    expect(() => callToDriver('0xZZ')).toThrow()
    expect(() => callToDriver('xyz')).toThrow()
    // Odd length should also throw
    expect(() => callToDriver('abc')).toThrow()
  })
})