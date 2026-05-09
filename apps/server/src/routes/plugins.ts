import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '@ghost/auth'
import { pluginRegistry } from '@ghost/plugins'

/**
 * Plugin management routes.
 *
 * Routes:
 *   GET  /api/plugins          — list all registered plugins
 *   GET  /api/plugins/commands — list all plugin commands
 *   GET  /api/plugins/panels   — list all plugin UI panels
 */

function getAuthUser(req: FastifyRequest): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    return verifyToken(token, process.env['JWT_SECRET']!).sub
  } catch {
    return null
  }
}

export async function registerPluginRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/plugins
   * List all registered plugins.
   */
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthUser(req)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })
    return reply.send({ plugins: pluginRegistry.list() })
  })

  /**
   * GET /api/plugins/commands
   * List all commands contributed by registered plugins.
   */
  app.get('/commands', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthUser(req)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const commands = pluginRegistry.getAllCommands().map(({ pluginId, command }) => ({
      pluginId,
      id: command.id,
      label: command.label,
      keybinding: command.keybinding,
      category: command.category,
    }))
    return reply.send({ commands })
  })

  /**
   * GET /api/plugins/panels
   * List all UI panels contributed by registered plugins.
   */
  app.get('/panels', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthUser(req)
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' })

    const panels = pluginRegistry.getAllPanels().map(({ pluginId, panel }) => ({
      pluginId,
      id: panel.id,
      title: panel.title,
      icon: panel.icon,
      position: panel.position,
    }))
    return reply.send({ panels })
  })
}
