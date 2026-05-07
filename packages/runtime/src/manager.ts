import Dockerode from 'dockerode'
import type { EventDispatcher } from '@ghost/events'
import type { RuntimeState } from '@ghost/protocol'
import { now } from '@ghost/shared'

export interface StartContainerOptions {
  workspaceId: string
  image?: string
  command?: string[]
  env?: Record<string, string>
  /** Called with each log line as it streams */
  onLog?: (line: string, stream: 'stdout' | 'stderr') => void
}

/**
 * RuntimeManager orchestrates Docker containers for workspace previews.
 *
 * Workflow triggered by a file save:
 *   file saved
 *   → event: file.updated
 *   → RuntimeManager.rebuild()
 *   → docker build
 *   → stream logs via onLog callback
 *   → emit event: runtime.started / runtime.build_failed
 *   → broadcast preview URL via websocket
 *
 * Each workspace gets at most ONE container. Starting a new one
 * stops the previous container automatically.
 */
export class RuntimeManager {
  private readonly docker: Dockerode
  /** workspaceId → containerId */
  private readonly containers = new Map<string, string>()

  constructor(
    private readonly events: EventDispatcher,
    dockerOptions?: Dockerode.DockerOptions
  ) {
    this.docker = new Dockerode(
      dockerOptions ?? { socketPath: process.env['DOCKER_HOST'] ?? '/var/run/docker.sock' }
    )
  }

  /**
   * Start (or restart) a container for a workspace.
   * Returns the preview URL once the container is running.
   */
  async start(options: StartContainerOptions): Promise<RuntimeState> {
    const { workspaceId, image = 'node:20-alpine', command, env = {}, onLog } = options

    // Stop any existing container for this workspace
    await this.stop(workspaceId)

    await this.events.dispatch('runtime.build_started', workspaceId, {})

    try {
      const container = await this.docker.createContainer({
        Image: image,
        Cmd: command ?? ['sh', '-c', 'npm install && npm start'],
        Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
        Labels: { 'ghost.workspaceId': workspaceId },
        HostConfig: {
          NetworkMode: process.env['RUNTIME_NETWORK'] ?? 'ghost_runtime',
          AutoRemove: true,
          // Restrict resource usage per container
          Memory: 512 * 1024 * 1024, // 512 MB
          CpuShares: 512,
        },
        ExposedPorts: { '3000/tcp': {} },
      })

      await container.start()
      this.containers.set(workspaceId, container.id)

      // Stream logs asynchronously
      if (onLog) {
        container.logs(
          { stdout: true, stderr: true, follow: true, timestamps: false },
          (err, stream) => {
            if (err || !stream) return
            stream.on('data', (chunk: Buffer) => {
              // Docker multiplexes stdout/stderr: byte 0 is stream type (1=stdout, 2=stderr)
              const streamType = chunk[0] === 2 ? 'stderr' : 'stdout'
              const line = chunk.slice(8).toString('utf8').trimEnd()
              if (line) onLog(line, streamType)
            })
          }
        )
      }

      // Inspect to get mapped port for preview URL
      const info = await container.inspect()
      const hostPort =
        info.NetworkSettings?.Ports?.['3000/tcp']?.[0]?.HostPort ?? '3000'
      const previewUrl = `http://localhost:${hostPort}`

      const state: RuntimeState = {
        workspaceId,
        status: 'running',
        containerId: container.id,
        previewUrl,
        buildLogs: [],
        startedAt: now(),
      }

      await this.events.dispatch('runtime.started', workspaceId, {
        containerId: container.id,
        image,
        previewUrl,
      })

      return state
    } catch (error) {
      const err = error as Error
      await this.events.dispatch('runtime.error', workspaceId, {
        message: err.message,
      })
      return {
        workspaceId,
        status: 'error',
        buildLogs: [err.message],
      }
    }
  }

  /**
   * Stop and remove the container for a workspace.
   */
  async stop(workspaceId: string): Promise<void> {
    const containerId = this.containers.get(workspaceId)
    if (!containerId) return

    try {
      const container = this.docker.getContainer(containerId)
      await container.stop({ t: 5 })
    } catch {
      // Container may already be stopped/removed
    } finally {
      this.containers.delete(workspaceId)
      await this.events.dispatch('runtime.stopped', workspaceId, { containerId })
    }
  }

  /**
   * Returns the runtime status for a workspace.
   */
  async getStatus(workspaceId: string): Promise<RuntimeState['status']> {
    const containerId = this.containers.get(workspaceId)
    if (!containerId) return 'idle'

    try {
      const container = this.docker.getContainer(containerId)
      const info = await container.inspect()
      return info.State.Running ? 'running' : 'stopped'
    } catch {
      return 'stopped'
    }
  }

  /**
   * Trigger a rebuild by stopping and restarting the workspace container.
   */
  async rebuild(options: StartContainerOptions): Promise<RuntimeState> {
    return this.start(options)
  }
}
