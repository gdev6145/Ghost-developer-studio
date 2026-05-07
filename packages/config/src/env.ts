import { z } from 'zod'

/**
 * Server environment schema.
 * Validated at startup – missing required variables crash the process early.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // Database
  DATABASE_URL: z.string().url().min(1),

  // Redis
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // GitHub OAuth (optional – feature-flagged)
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),

  // Docker
  DOCKER_HOST: z.string().default('unix:///var/run/docker.sock'),
  RUNTIME_NETWORK: z.string().default('ghost_runtime'),

  // Git / repository management
  /** Root directory where workspace repositories are cloned. */
  GHOST_REPOS_PATH: z.string().default('/tmp/ghost-repos'),

  // AI (optional — features degrade gracefully without API key)
  OPENAI_API_KEY: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Validates and returns the server environment.
 * Call once at server startup. Throws on invalid config.
 */
export function validateServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(env)
  if (!result.success) {
    const formatted = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid server environment variables:\n${formatted}`)
  }
  return result.data
}

/**
 * Browser / web app environment schema.
 * Only NEXT_PUBLIC_ prefixed vars are exposed to the browser.
 */
const webEnvSchema = z.object({
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:4000'),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:4000'),
})

export type WebEnv = z.infer<typeof webEnvSchema>

export function validateWebEnv(env: Record<string, string | undefined> = {}): WebEnv {
  const result = webEnvSchema.safeParse(env)
  if (!result.success) {
    console.warn('[ghost/config] Web env validation issues:', result.error.format())
    return webEnvSchema.parse({})
  }
  return result.data
}
