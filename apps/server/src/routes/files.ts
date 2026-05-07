import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import { verifyToken } from '@ghost/auth'
import { getLanguageFromPath, generateId } from '@ghost/shared'

function getUserId(req: FastifyRequest): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    return verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    return null
  }
}

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/files/:workspaceId
   * List file tree for a workspace
   */
  app.get(
    '/:workspaceId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const files = await db.file.findMany({
        where: { workspaceId: req.params.workspaceId },
        select: { id: true, path: true, name: true, type: true, language: true, parentId: true, updatedAt: true },
        orderBy: [{ type: 'asc' }, { path: 'asc' }],
      })

      return reply.send(files)
    }
  )

  /**
   * GET /api/files/:workspaceId/content/:fileId
   * Get file content (decoded from Yjs binary)
   */
  app.get(
    '/:workspaceId/content/:fileId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string; fileId: string } }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const file = await db.file.findUnique({ where: { id: req.params.fileId } })
      if (!file) return reply.status(404).send({ error: 'File not found' })

      return reply.send({
        id: file.id,
        path: file.path,
        name: file.name,
        language: file.language,
        // Content is Yjs binary; clients apply it to Y.Doc
        content: file.content ? Buffer.from(file.content).toString('base64') : null,
      })
    }
  )

  /**
   * POST /api/files/:workspaceId
   * Create a file
   */
  app.post(
    '/:workspaceId',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { path: string; type?: 'file' | 'directory'; content?: string }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { path, type = 'file', content } = req.body
      const name = path.split('/').pop() ?? path
      const language = type === 'file' ? getLanguageFromPath(path) : undefined

      const file = await db.file.create({
        data: {
          workspaceId: req.params.workspaceId,
          path,
          name,
          type,
          language,
          content: content ? Buffer.from(content) : undefined,
        },
      })

      return reply.status(201).send(file)
    }
  )

  /**
   * DELETE /api/files/:workspaceId/:fileId
   * Delete a file
   */
  app.delete(
    '/:workspaceId/:fileId',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string; fileId: string } }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      await db.file.delete({ where: { id: req.params.fileId } })
      return reply.status(204).send()
    }
  )
}
