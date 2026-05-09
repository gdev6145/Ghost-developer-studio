import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '@ghost/database'
import type { WorkspaceRole } from '@ghost/database'
import { getUserId } from '../utils/auth'

/**
 * RBAC middleware for workspace-scoped routes.
 *
 * Usage in route handlers:
 *   const { userId, role } = await requireWorkspaceRole(req, reply, workspaceId, ['owner', 'admin'])
 *   if (!userId) return // reply already sent
 */

export interface WorkspaceAccess {
  userId: string
  role: WorkspaceRole
}

/**
 * Verify the caller has one of the allowed roles in the workspace.
 * Returns the access record if allowed, or sends a 401/403 reply and returns null.
 */
export async function requireWorkspaceRole(
  req: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
  allowedRoles: WorkspaceRole[] = ['owner', 'admin', 'editor', 'viewer']
): Promise<WorkspaceAccess | null> {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    void reply.status(401).send({ error: 'Unauthorized' })
    return null
  }

  let userId: string
  try {
    userId = verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    void reply.status(401).send({ error: 'Invalid token' })
    return null
  }

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })

  if (!member) {
    void reply.status(403).send({ error: 'Not a member of this workspace' })
    return null
  }

  if (!allowedRoles.includes(member.role)) {
    void reply.status(403).send({
      error: `Insufficient permissions. Required: ${allowedRoles.join(' or ')}. Current: ${member.role}`,
    })
    return null
  }

  return { userId, role: member.role }
}

/**
 * Check if the user is the workspace owner (used for destructive operations).
 */
export async function requireWorkspaceOwner(
  req: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string
): Promise<WorkspaceAccess | null> {
  return requireWorkspaceRole(req, reply, workspaceId, ['owner'])
}

/**
 * Check if the user can write (editor or above).
 */
export async function requireWriteAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string
): Promise<WorkspaceAccess | null> {
  return requireWorkspaceRole(req, reply, workspaceId, ['owner', 'admin', 'editor'])
}

/**
 * Check if the user has admin access (admin or owner).
 */
export async function requireAdminAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string
): Promise<WorkspaceAccess | null> {
  return requireWorkspaceRole(req, reply, workspaceId, ['owner', 'admin'])
}
