/**
 * Future roadmap capability contracts.
 *
 * These types intentionally define structure only and do not imply
 * implementation status.
 */

export type FutureCapabilityStatus = 'planned' | 'experimental' | 'disabled' | 'enabled'

export type FutureCapabilityKey =
  | 'aiPairProgramming'
  | 'sessionReplay'
  | 'collaborativeDebugging'
  | 'branchVisualization'
  | 'multiplayerTerminals'
  | 'workspaceMemory'

export interface FutureCapabilityBase {
  key: FutureCapabilityKey
  status: FutureCapabilityStatus
}

export interface AiPairProgrammingCapability extends FutureCapabilityBase {
  key: 'aiPairProgramming'
  providers: string[]
  supportsEventSubscriptions: boolean
}

export interface SessionReplayCapability extends FutureCapabilityBase {
  key: 'sessionReplay'
  retentionDays: number
  supportsTimelineScrubbing: boolean
}

export interface CollaborativeDebuggingCapability extends FutureCapabilityBase {
  key: 'collaborativeDebugging'
  supportsSharedBreakpoints: boolean
  supportsDebuggerPresence: boolean
}

export interface BranchVisualizationCapability extends FutureCapabilityBase {
  key: 'branchVisualization'
  supportsRealtimeGraph: boolean
}

export interface MultiplayerTerminalsCapability extends FutureCapabilityBase {
  key: 'multiplayerTerminals'
  supportsSharedPty: boolean
  supportsAccessControl: boolean
}

export interface WorkspaceMemoryCapability extends FutureCapabilityBase {
  key: 'workspaceMemory'
  embeddingModel?: string
  supportsSemanticLookup: boolean
}

export type FutureCapability =
  | AiPairProgrammingCapability
  | SessionReplayCapability
  | CollaborativeDebuggingCapability
  | BranchVisualizationCapability
  | MultiplayerTerminalsCapability
  | WorkspaceMemoryCapability

export interface FuturePlatformStructure {
  capabilities: FutureCapability[]
}
