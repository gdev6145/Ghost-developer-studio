import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { generateId } from '@ghost/shared'
import { requireWriteAccess } from '../middleware/rbac'
import { getUserId } from '../utils/auth'

/**
 * Workspace Template routes.
 *
 * Templates define a starter workspace configuration including:
 * - Base file tree (seed files, configs, scripts)
 * - Runtime environment settings
 * - Recommended extensions/plugins
 * - Policy packs
 *
 * Routes:
 *   GET    /api/templates              — list all public templates
 *   GET    /api/templates/:templateId  — get template details
 *   POST   /api/templates              — create a template (admin)
 *   POST   /api/templates/:templateId/apply/:workspaceId — apply template to workspace
 */

export interface WorkspaceTemplate {
  templateId: string
  name: string
  description: string
  language: string
  tags: string[]
  /** Starter files to seed into the workspace */
  files: Array<{ path: string; content: string }>
  /** Recommended plugins by ID */
  recommendedPlugins: string[]
  createdAt: string
  isPublic: boolean
}

// Built-in templates shipped with Ghost Developer Studio
const BUILT_IN_TEMPLATES: WorkspaceTemplate[] = [
  {
    templateId: 'node-api',
    name: 'Node.js REST API',
    description: 'Fastify + TypeScript starter with Prisma ORM and Jest tests',
    language: 'typescript',
    tags: ['node', 'typescript', 'api', 'fastify'],
    files: [
      { path: 'src/index.ts', content: `import Fastify from 'fastify'\nconst app = Fastify({ logger: true })\napp.get('/health', async () => ({ status: 'ok' }))\nvoid app.listen({ port: 3000, host: '0.0.0.0' })\n` },
      { path: 'package.json', content: JSON.stringify({ name: 'my-api', version: '1.0.0', scripts: { dev: 'tsx watch src/index.ts', build: 'tsup src/index.ts', test: 'jest' }, dependencies: { fastify: '^5.0.0' }, devDependencies: { tsx: '^4.0.0', tsup: '^8.0.0', typescript: '^5.0.0' } }, null, 2) },
      { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, outDir: 'dist' } }, null, 2) },
      { path: 'README.md', content: '# My API\n\nA Fastify REST API built with Ghost Developer Studio.\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n' },
    ],
    recommendedPlugins: [],
    createdAt: '2026-01-01T00:00:00Z',
    isPublic: true,
  },
  {
    templateId: 'next-app',
    name: 'Next.js Web App',
    description: 'Next.js 15 + TypeScript + Tailwind CSS starter',
    language: 'typescript',
    tags: ['react', 'next', 'typescript', 'tailwind'],
    files: [
      { path: 'app/page.tsx', content: `export default function Home() {\n  return <main className="p-8"><h1 className="text-2xl font-bold">Hello from Ghost Studio</h1></main>\n}\n` },
      { path: 'package.json', content: JSON.stringify({ name: 'my-app', version: '1.0.0', scripts: { dev: 'next dev', build: 'next build', start: 'next start' }, dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { typescript: '^5.0.0', tailwindcss: '^4.0.0' } }, null, 2) },
      { path: 'README.md', content: '# My Next.js App\n\nBuilt with Ghost Developer Studio.\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n' },
    ],
    recommendedPlugins: [],
    createdAt: '2026-01-01T00:00:00Z',
    isPublic: true,
  },
  {
    templateId: 'python-service',
    name: 'Python FastAPI Service',
    description: 'FastAPI + Pydantic + SQLAlchemy starter with pytest',
    language: 'python',
    tags: ['python', 'fastapi', 'api'],
    files: [
      { path: 'main.py', content: 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n' },
      { path: 'requirements.txt', content: 'fastapi>=0.100.0\nuvicorn>=0.23.0\npydantic>=2.0.0\n' },
      { path: 'README.md', content: '# My Python Service\n\nBuilt with Ghost Developer Studio.\n\n## Getting Started\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload\n```\n' },
    ],
    recommendedPlugins: [],
    createdAt: '2026-01-01T00:00:00Z',
    isPublic: true,
  },
]

// Custom templates (user-created)
const customTemplates = new Map<string, WorkspaceTemplate>()


export async function registerTemplateRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/templates
   * List all available templates (built-in + public custom).
   */
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(req)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const custom = Array.from(customTemplates.values()).filter(t => t.isPublic)
    const all = [
      ...BUILT_IN_TEMPLATES.map(t => ({ ...t, files: undefined })),
      ...custom.map(t => ({ ...t, files: undefined })),
    ]
    return reply.send({ templates: all })
  })

  /**
   * GET /api/templates/:templateId
   * Get full template details including files.
   */
  app.get(
    '/:templateId',
    async (req: FastifyRequest<{ Params: { templateId: string } }>, reply: FastifyReply) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const template =
        BUILT_IN_TEMPLATES.find(t => t.templateId === req.params.templateId) ??
        customTemplates.get(req.params.templateId)

      if (!template) return reply.status(404).send({ error: 'Template not found' })

      return reply.send(template)
    }
  )

  /**
   * POST /api/templates
   * Create a custom template.
   */
  app.post(
    '/',
    async (
      req: FastifyRequest<{
        Body: Omit<WorkspaceTemplate, 'templateId' | 'createdAt'>
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { name, description, language, tags, files, recommendedPlugins, isPublic } = req.body

      const template: WorkspaceTemplate = {
        templateId: generateId(),
        name,
        description,
        language,
        tags: tags ?? [],
        files: files ?? [],
        recommendedPlugins: recommendedPlugins ?? [],
        createdAt: new Date().toISOString(),
        isPublic: isPublic ?? false,
      }

      customTemplates.set(template.templateId, template)
      return reply.status(201).send(template)
    }
  )

  /**
   * POST /api/templates/:templateId/apply/:workspaceId
   * Seed a workspace with a template's starter files.
   */
  app.post(
    '/:templateId/apply/:workspaceId',
    async (
      req: FastifyRequest<{ Params: { templateId: string; workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const template =
        BUILT_IN_TEMPLATES.find(t => t.templateId === req.params.templateId) ??
        customTemplates.get(req.params.templateId)

      if (!template) return reply.status(404).send({ error: 'Template not found' })

      const { workspaceId } = req.params

      // Seed files into the workspace (skip files that already exist)
      const created: string[] = []
      for (const f of template.files) {
        const existing = await db.file.findUnique({
          where: { workspaceId_path: { workspaceId, path: f.path } },
        })
        if (!existing) {
          await db.file.create({
            data: {
              workspaceId,
              path: f.path,
              name: f.path.split('/').pop() ?? f.path,
              type: 'file',
              content: Buffer.from(f.content, 'utf-8'),
            },
          })
          created.push(f.path)
        }
      }

      return reply.send({
        templateId: template.templateId,
        workspaceId,
        filesCreated: created,
        recommendedPlugins: template.recommendedPlugins,
      })
    }
  )
}
