# Ghost Developer Studio

**Realtime collaborative developer operating system.**

> Multiple users. Same workspace. Same files. Live cursors. Live edits. Live presence.

Ghost Developer Studio is a real-time collaborative coding platform built for teams that want to design, code, review, and ship software together in a shared multiplayer environment. It is built as a multiplayer-first, event-driven developer platform monorepo.

---

## Vision

Build a developer-first studio where distributed teams can:

- Write and review code together in real time
- Share infrastructure and environments safely
- Move from idea to deployment without leaving the platform
- Keep collaboration fast, transparent, and traceable

---

## Core Capabilities

- **Live collaborative editing** — multiple users edit the same file simultaneously with live cursors (Yjs + Monaco)
- **Workspace presence** — see who's online, what they're editing, and their cursor position
- **Workspace chat** — realtime messaging built into the dev environment
- **Live preview** — Docker-powered container builds with streaming logs and instant preview
- **Git integration** — clone, branch, commit, push via GitHub
- **Desktop app** — Electron wrapper with local filesystem and Docker access
- **Shared terminal access** for pair debugging, setup, and operational workflows
- **Notifications and activity tracking** for project awareness

---

## Architecture

```
ghost/
├── apps/
│   ├── web/          # Next.js React web app
│   ├── desktop/      # Electron desktop app
│   └── server/       # Fastify backend + Socket.IO
│
├── packages/
│   ├── protocol/     # Shared typed contracts (WS messages, interfaces)
│   ├── shared/       # Common utilities (generateId, colors, debounce)
│   ├── config/       # Environment validation (Zod schemas)
│   ├── events/       # Internal event bus (EventDispatcher)
│   ├── collaboration/# Yjs engine + CollaborationClient
│   ├── editor/       # Monaco bindings + Ghost theme
│   ├── state/        # Zustand stores (workspace, editor, presence, chat, runtime)
│   ├── ui/           # Shared React components (Avatar, StatusBadge, Layout)
│   ├── database/     # Prisma schema + PostgreSQL client
│   ├── auth/         # JWT sign/verify utilities
│   ├── runtime/      # Docker orchestration (RuntimeManager)
│   └── git/          # Git integration (simple-git wrapper)
│
├── docker/           # Docker Compose + Dockerfiles
├── scripts/          # Dev setup scripts
└── .github/          # CI/CD workflows
```

### Realtime Collaboration Stack

```
Monaco Editor
  ↓ y-monaco binding
Yjs Document (Y.Text per file)
  ↓ CollaborationClient
Socket.IO (ws transport)
  ↓ Redis Adapter (pub/sub for horizontal scaling)
Server collaboration handler
  ↓ Prisma
PostgreSQL (binary Yjs state persisted per file)
```

### WebSocket Protocol

All messages use typed envelopes from `@ghost/protocol`:

```typescript
interface WsEnvelope {
  type: WsEventType    // e.g., 'document.update', 'presence.cursor'
  workspaceId: string
  actorId: string
  timestamp: string
  payload: object
}
```

---

## Tech Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Frontend      | React, Next.js 15, TypeScript           |
| Styling       | TailwindCSS (Ghost dark theme)          |
| State         | Zustand                                 |
| Collaboration | Yjs, y-monaco, Socket.IO client         |
| Backend       | Fastify 5, Node.js 20, TypeScript       |
| Realtime      | Socket.IO 4, Redis pub/sub adapter      |
| Database      | PostgreSQL 16, Prisma ORM               |
| Desktop       | Electron 39                             |
| Runtime       | Docker (workspace preview containers)   |
| Monorepo      | TurboRepo, pnpm workspaces              |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL, Redis, and workspace containers)

### Automated Setup

```bash
./scripts/dev-setup.sh
```

### Manual Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables and edit them
cp .env.example .env

# Start infrastructure
docker compose -f docker/docker-compose.yml up -d postgres redis

# Run database migrations
pnpm --filter "@ghost/database" run db:migrate

# Build shared packages
pnpm run build --filter="./packages/*"

# Start all dev servers
pnpm run dev
```

### Access

| Service | URL                       |
|---------|---------------------------|
| Web App | http://localhost:3000      |
| Server  | http://localhost:4000      |
| Health  | http://localhost:4000/health |

---

## Core Packages

### `@ghost/protocol`
Shared TypeScript interfaces and typed WebSocket contracts. Import here to get all shared types:
```typescript
import type { Workspace, WsMessage, PresenceState } from '@ghost/protocol'
```

### `@ghost/collaboration`
The realtime collaboration engine:
```typescript
const collab = new CollaborationClient({ userId, workspaceId, socket })
collab.joinWorkspace(displayName)
collab.openFile(fileId)
collab.on('document:updated', fileId => { /* re-render */ })
```

### `@ghost/state`
Zustand stores for all UI state:
```typescript
const workspace = useWorkspaceStore(s => s.workspace)
const onlineUsers = usePresenceStore(s => s.onlineUsers)
const messages = useChatStore(s => s.messages)
const { status, previewUrl } = useRuntimeStore()
```

### `@ghost/events`
Internal event bus for server-side domain events:
```typescript
eventBus.on('file.updated', async event => {
  // trigger rebuild, broadcast, persist
})
await eventBus.dispatch('user.joined', workspaceId, { userId })
```

---

## Development

```bash
pnpm run dev        # All apps in parallel
pnpm run build      # Production build
pnpm run typecheck  # TypeScript check
pnpm run lint       # ESLint
pnpm run test       # Tests
```

---

## Docker Deployment

```bash
# Full stack
docker compose -f docker/docker-compose.yml up -d

# Infrastructure only (for local dev)
docker compose -f docker/docker-compose.yml up -d postgres redis
```

---

## Design Principles

- **Collaborative by default:** core workflows support pair and team development out of the box
- **Context in one place:** code, runtime, review, and communication stay connected
- **Secure shared access:** collaboration preserves repository and environment safety boundaries
- **Incremental delivery:** capabilities introduced in stages with clear value at each step

---

## Product Goals

- **Speed:** reduce friction between coding, testing, and reviewing
- **Reliability:** maintain stable synchronized sessions for collaborators
- **Security:** support safe access to repositories and runtime environments
- **Scalability:** enable collaboration from small teams to larger organizations

---

## Contributing

Contributions are welcome as the project evolves. You can contribute by:

- Proposing features and use cases through issues
- Suggesting improvements to architecture and product documentation
- Submitting pull requests for implementation modules

---

## Future Roadmap

The architecture is designed to support (not yet implemented):

- **AI pair programming** — LLM agents subscribe to the event bus
- **Session replay** — events are persisted; replay is an event consumer
- **Collaborative debugging** — shared breakpoints via workspace events
- **Branch visualization** — real-time git graph
- **Multiplayer terminals** — PTY over Socket.IO
- **Workspace memory** — vectorized event history for AI context

---

## License

This project is released under the [MIT License](LICENSE).
