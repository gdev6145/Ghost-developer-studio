import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { generateId, now } from '@ghost/shared'
import { db } from '@ghost/database'
import { requireWriteAccess } from '../middleware/rbac'
import { getUserId } from '../utils/auth'

/**
 * Safe-edit guardrail routes.
 *
 * A safe-edit is a proposed file change that requires explicit approval before
 * being applied. This is used by the AI task orchestrator and can also be used
 * by automated tools to prevent accidental bulk changes.
 *
 * Routes:
 *   POST   /api/safe-edits/:workspaceId         — propose a change (creates pending edit)
 *   GET    /api/safe-edits/:workspaceId          — list pending edits
 *   POST   /api/safe-edits/:workspaceId/:editId/approve — approve and apply the change
 *   POST   /api/safe-edits/:workspaceId/:editId/reject  — reject the change
 */

export type SafeEditStatus = 'pending' | 'approved' | 'rejected'
export type SafeEditRisk = 'low' | 'medium' | 'high'

export interface SafeEdit {
  editId: string
  workspaceId: string
  fileId: string
  filePath: string
  proposedBy: string
  description: string
  /** Diff or new content */
  content: string
  risk: SafeEditRisk
  status: SafeEditStatus
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
}

/**
 * Risk scoring heuristic: higher risk for larger changes or certain file types.
 */
function scoreRisk(content: string, filePath: string): SafeEditRisk {
  const lines = content.split('\n').length
  const isSensitivePath =
    filePath.includes('auth') ||
    filePath.includes('secret') ||
    filePath.includes('config') ||
    filePath.includes('prisma') ||
    filePath.includes('migration')

  if (isSensitivePath || lines > 100) return 'high'
  if (lines > 30) return 'medium'
  return 'low'
}

// In-memory store for safe edits (production: use Redis or PostgreSQL)
const safeEdits = new Map<string, SafeEdit>()

export async function registerSafeEditRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/safe-edits/:workspaceId
   * Propose a file change pending approval.
   * Body: { fileId, description, content }
   */
  app.post(
    '/:workspaceId',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Body: { fileId: string; description: string; content: string }
      }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const { fileId, description, content } = req.body
      if (!fileId || !content) {
        return reply.status(400).send({ error: 'fileId and content are required' })
      }

      // Look up file to get path for risk scoring
      const file = await db.file.findUnique({ where: { id: fileId }, select: { path: true } })
      if (!file) return reply.status(404).send({ error: 'File not found' })

      const risk = scoreRisk(content, file.path)
      const edit: SafeEdit = {
        editId: generateId(),
        workspaceId: req.params.workspaceId,
        fileId,
        filePath: file.path,
        proposedBy: access.userId,
        description,
        content,
        risk,
        status: 'pending',
        createdAt: now(),
      }

      safeEdits.set(edit.editId, edit)

      return reply.status(201).send(edit)
    }
  )

  /**
   * GET /api/safe-edits/:workspaceId
   * List pending safe edits for the workspace.
   */
  app.get(
    '/:workspaceId',
    async (
      req: FastifyRequest<{
        Params: { workspaceId: string }
        Querystring: { status?: SafeEditStatus }
      }>,
      reply: FastifyReply
    ) => {
      const userId = getUserId(req)
      if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

      const { workspaceId } = req.params
      const { status = 'pending' } = req.query

      const edits = Array.from(safeEdits.values()).filter(
        e => e.workspaceId === workspaceId && e.status === status
      )

      return reply.send({ edits })
    }
  )

  /**
   * POST /api/safe-edits/:workspaceId/:editId/approve
   * Approve and apply the proposed change. Requires admin or owner.
   */
  app.post(
    '/:workspaceId/:editId/approve',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string; editId: string } }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const edit = safeEdits.get(req.params.editId)
      if (!edit || edit.workspaceId !== req.params.workspaceId) {
        return reply.status(404).send({ error: 'Safe edit not found' })
      }
      if (edit.status !== 'pending') {
        return reply.status(409).send({ error: `Edit is already ${edit.status}` })
      }

      // Apply: update file content in the database
      await db.file.update({
        where: { id: edit.fileId },
        data: {
          content: Buffer.from(edit.content),
          updatedAt: new Date(),
        },
      })

      edit.status = 'approved'
      edit.resolvedAt = now()
      edit.resolvedBy = access.userId

      return reply.send(edit)
    }
  )

  /**
   * POST /api/safe-edits/:workspaceId/:editId/reject
   * Reject a proposed change.
   */
  app.post(
    '/:workspaceId/:editId/reject',
    async (
      req: FastifyRequest<{ Params: { workspaceId: string; editId: string } }>,
      reply: FastifyReply
    ) => {
      const access = await requireWriteAccess(req, reply, req.params.workspaceId)
      if (!access) return

      const edit = safeEdits.get(req.params.editId)
      if (!edit || edit.workspaceId !== req.params.workspaceId) {
        return reply.status(404).send({ error: 'Safe edit not found' })
      }
      if (edit.status !== 'pending') {
        return reply.status(409).send({ error: `Edit is already ${edit.status}` })
      }

      edit.status = 'rejected'
      edit.resolvedAt = now()
      edit.resolvedBy = access.userId

      return reply.send(edit)
    }
  )
}
