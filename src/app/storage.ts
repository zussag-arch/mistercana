import type {
  AppState,
  ArchivedAuction,
  AuctionAssignment,
  AuctionPhase,
  Manager,
  PmaConfiguration,
} from './state'

import {
  defaultState,
} from './state'

import type {
  ObjectivePriority,
  PlayerObjective,
} from '../domain/objective'

const STORAGE_KEY =
  'mistercana_app_state_v1'

const BACKUP_TYPE =
  'mistercana-state-backup'

const BACKUP_VERSION = 1

type LegacyManager =
  Partial<Manager> & {
    name?: unknown
  }

type LegacyState =
  Partial<
    Omit<
      AppState,
      | 'managers'
      | 'auctionPhase'
      | 'objectives'
      | 'currentAuctionPlayerId'
      | 'auctionAssignments'
      | 'archivedAuctions'
      | 'recommendedDiscards'
    >
  > & {
    auctionPhase?: unknown

    currentAuctionPlayerId?: unknown

    auctionAssignments?: unknown

    archivedAuctions?: unknown

    recommendedDiscards?: unknown

    managers?: LegacyManager[]

    objectives?: unknown
  }

interface BackupEnvelope {
  type: string

  version: number

  exportedAt: string

  state: unknown
}

export type StateBackupParseResult =
  | {
      ok: true

      state: AppState

      exportedAt: string

      version: number
    }
  | {
      ok: false

      error: string
    }

/* =========================
   SAVE
========================= */

export function saveState(
  state: AppState,
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state),
  )
}

/* =========================
   AUCTION PHASE MIGRATION
========================= */

function normalizeAuctionPhase(
  phase: unknown,
): AuctionPhase {
  if (
    phase === 'completed'
  ) {
    return 'finalizing'
  }

  if (
    phase === 'archived' ||
    phase === 'discarded'
  ) {
    return 'setup'
  }

  if (
    phase === 'setup' ||
    phase === 'live' ||
    phase === 'finalizing'
  ) {
    return phase
  }

  return 'setup'
}

function normalizeCurrentAuctionPlayerId(
  value: unknown,
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const clean =
    value.trim()

  return clean
    ? clean
    : null
}

/* =========================
   RECOMMENDATION DISCARDS
========================= */

function migrateRecommendedDiscards(
  value: unknown,
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return []
  }

  const result:
    string[] = []

  const seen =
    new Set<string>()

  value.forEach(
    (item) => {
      if (
        typeof item !==
        'string'
      ) {
        return
      }

      const playerId =
        item.trim()

      if (
        !playerId ||
        seen.has(
          playerId,
        )
      ) {
        return
      }

      seen.add(
        playerId,
      )

      result.push(
        playerId,
      )
    },
  )

  return result
}

/* =========================
   MANAGERS
========================= */

function splitLegacyName(
  value: string,
): {
  firstName: string
  lastName: string
} {
  const clean =
    value.trim()

  if (!clean) {
    return {
      firstName:
        'Allenatore',

      lastName:
        '',
    }
  }

  const parts =
    clean.split(/\s+/)

  if (
    parts.length === 1
  ) {
    return {
      firstName:
        parts[0],

      lastName:
        '',
    }
  }

  return {
    firstName:
      parts[0],

    lastName:
      parts
        .slice(1)
        .join(' '),
  }
}

function migrateManager(
  manager: LegacyManager,
  index: number,
): Manager {
  let firstName =
    typeof manager.firstName ===
      'string'
      ? manager.firstName.trim()
      : ''

  let lastName =
    typeof manager.lastName ===
      'string'
      ? manager.lastName.trim()
      : ''

  if (
    !firstName &&
    typeof manager.name ===
      'string'
  ) {
    const migrated =
      splitLegacyName(
        manager.name,
      )

    firstName =
      migrated.firstName

    lastName =
      migrated.lastName
  }

  if (!firstName) {
    firstName =
      'Allenatore'
  }

  return {
    id:
      typeof manager.id ===
        'string' &&
      manager.id.trim()
        ? manager.id.trim()
        : `manager_migrated_${index}`,

    firstName,

    lastName,

    alias:
      typeof manager.alias ===
        'string'
        ? manager.alias.trim()
        : '',

    teamName:
      typeof manager.teamName ===
        'string'
        ? manager.teamName.trim()
        : '',

    isOwner:
      typeof manager.isOwner ===
        'boolean'
        ? manager.isOwner
        : false,

    active:
      typeof manager.active ===
        'boolean'
        ? manager.active
        : true,

    archived:
      typeof manager.archived ===
        'boolean'
        ? manager.archived
        : false,
  }
}

/* =========================
   OBJECTIVES
========================= */

function isObjectivePriority(
  value: unknown,
): value is ObjectivePriority {
  return (
    value === 'primary' ||
    value === 'secondary' ||
    value === 'third' ||
    value === 'fourth' ||
    value === 'bet'
  )
}

function migrateObjectives(
  value: unknown,
): PlayerObjective[] {
  if (
    !Array.isArray(value)
  ) {
    return []
  }

  const objectives:
    PlayerObjective[] = []

  const seenPlayerIds =
    new Set<string>()

  value.forEach(
    (item) => {
      if (
        !item ||
        typeof item !==
          'object'
      ) {
        return
      }

      const candidate =
        item as {
          playerId?: unknown
          priority?: unknown
          weight?: unknown
        }

      if (
        typeof candidate.playerId !==
          'string' ||
        !candidate.playerId.trim()
      ) {
        return
      }

      if (
        !isObjectivePriority(
          candidate.priority,
        )
      ) {
        return
      }

      const playerId =
        candidate.playerId.trim()

      if (
        seenPlayerIds.has(
          playerId,
        )
      ) {
        return
      }

      seenPlayerIds.add(
        playerId,
      )

      objectives.push({
        playerId,

        priority:
          candidate.priority,

        weight:
          1,
      })
    },
  )

  return objectives
}

/* =========================
   AUCTION ASSIGNMENTS
========================= */

function normalizeManagerId(
  value: unknown,
): string {
  if (
    typeof value !==
    'string'
  ) {
    return ''
  }

  return value
    .trim()
    .replace(
      /^manager-/,
      '',
    )
}

function migrateAuctionAssignments(
  value: unknown,
): AuctionAssignment[] {
  if (
    !Array.isArray(value)
  ) {
    return []
  }

  const assignments:
    AuctionAssignment[] = []

  const seenPlayerIds =
    new Set<string>()

  value.forEach(
    (
      item,
      index,
    ) => {
      if (
        !item ||
        typeof item !==
          'object'
      ) {
        return
      }

      const candidate =
        item as {
          id?: unknown
          playerId?: unknown
          managerId?: unknown
          participantId?: unknown
          price?: unknown

          secondBidderManagerId?: unknown
          secondBidPrice?: unknown
        }

      if (
        typeof candidate.playerId !==
          'string' ||
        !candidate.playerId.trim()
      ) {
        return
      }

      const playerId =
        candidate.playerId.trim()

      const managerId =
        normalizeManagerId(
          candidate.managerId,
        ) ||
        normalizeManagerId(
          candidate.participantId,
        )

      const price =
        typeof candidate.price ===
          'number'
          ? candidate.price
          : Number(
              candidate.price,
            )

      if (
        !managerId ||
        !Number.isInteger(price) ||
        price <= 0
      ) {
        return
      }

      if (
        seenPlayerIds.has(
          playerId,
        )
      ) {
        return
      }

      seenPlayerIds.add(
        playerId,
      )

      const secondBidderManagerId =
        normalizeManagerId(
          candidate
            .secondBidderManagerId,
        )

      const parsedSecondBidPrice =
        typeof candidate
          .secondBidPrice ===
          'number'
          ? candidate
              .secondBidPrice
          : Number(
              candidate
                .secondBidPrice,
            )

      const secondBidPrice =
        Number.isInteger(
          parsedSecondBidPrice,
        ) &&
        parsedSecondBidPrice > 0
          ? parsedSecondBidPrice
          : undefined

      assignments.push({
        id:
          typeof candidate.id ===
            'string' &&
          candidate.id.trim()
            ? candidate.id.trim()
            : `assignment_migrated_${index}`,

        playerId,

        managerId,

        price,

        ...(secondBidderManagerId
          ? {
              secondBidderManagerId,
            }
          : {}),

        ...(secondBidPrice !==
        undefined
          ? {
              secondBidPrice,
            }
          : {}),
      })
    },
  )

  return assignments
}

/* =========================
   ARCHIVED AUCTIONS
========================= */

function migrateArchivedAuctions(
  value: unknown,
): ArchivedAuction[] {
  if (
    !Array.isArray(value)
  ) {
    return []
  }

  const auctions:
    ArchivedAuction[] = []

  value.forEach(
    (
      item,
      index,
    ) => {
      if (
        !item ||
        typeof item !==
          'object'
      ) {
        return
      }

      const candidate =
        item as {
          id?: unknown
          archivedAt?: unknown
          assignments?: unknown
        }

      const assignments =
        migrateAuctionAssignments(
          candidate.assignments,
        )

      const archivedAt =
        typeof candidate.archivedAt ===
          'string' &&
        candidate.archivedAt.trim()
          ? candidate.archivedAt.trim()
          : new Date(0)
              .toISOString()

      auctions.push({
        id:
          typeof candidate.id ===
            'string' &&
          candidate.id.trim()
            ? candidate.id.trim()
            : `auction_migrated_${index}`,

        archivedAt,

        assignments,
      })
    },
  )

  return auctions
}

/* =========================
   NORMALIZE STATE
========================= */

function normalizeState(
  parsed: LegacyState,
): AppState {
  const auctionPhase =
    normalizeAuctionPhase(
      parsed.auctionPhase,
    )

  const managers =
    Array.isArray(
      parsed.managers,
    )
      ? parsed.managers.map(
          migrateManager,
        )
      : structuredClone(
          defaultState.managers,
        )

  const objectives =
    migrateObjectives(
      parsed.objectives,
    )

  const auctionAssignments =
    auctionPhase === 'live' ||
    auctionPhase === 'finalizing'
      ? migrateAuctionAssignments(
          parsed.auctionAssignments,
        )
      : []

  const recommendedDiscards =
    auctionPhase === 'live' ||
    auctionPhase === 'finalizing'
      ? migrateRecommendedDiscards(
          parsed.recommendedDiscards,
        )
      : []

  const archivedAuctions =
    migrateArchivedAuctions(
      parsed.archivedAuctions,
    )

  const currentAuctionPlayerId =
    auctionPhase === 'live' ||
    auctionPhase === 'finalizing'
      ? normalizeCurrentAuctionPlayerId(
          parsed.currentAuctionPlayerId,
        )
      : null

  const pmaConfiguration =
    normalizePmaConfiguration(
      parsed.pmaConfiguration,
      parsed.defenseModifierEnabled,
    )

  return {
    auctionPhase,

    currentAuctionPlayerId,

    auctionAssignments,

    archivedAuctions,

    recommendedDiscards,

    initialCredits:
      typeof parsed.initialCredits ===
        'number' &&
      Number.isFinite(
        parsed.initialCredits,
      ) &&
      parsed.initialCredits > 0
        ? parsed.initialCredits
        : defaultState.initialCredits,

    defenseModifierEnabled:
      typeof parsed
        .defenseModifierEnabled ===
        'boolean'
        ? parsed
            .defenseModifierEnabled
        : defaultState
            .defenseModifierEnabled,

    pmaConfiguration,

    budgetProfile:
      parsed.budgetProfile ??
      defaultState.budgetProfile,

    budgetDistribution: {
      ...defaultState
        .budgetDistribution,

      ...parsed
        .budgetDistribution,
    },

    managers,

    objectives,
  }
}

/* =========================
   LOAD
========================= */

export function loadState():
  AppState {
  const raw =
    localStorage.getItem(
      STORAGE_KEY,
    )

  if (!raw) {
    return structuredClone(
      defaultState,
    )
  }

  try {
    const parsed =
      JSON.parse(
        raw,
      ) as LegacyState

    return normalizeState(
      parsed,
    )
  } catch {
    return structuredClone(
      defaultState,
    )
  }
}

/* =========================
   BACKUP EXPORT
========================= */

export function createStateBackup(
  state: AppState,
): string {
  const backup = {
    type:
      BACKUP_TYPE,

    version:
      BACKUP_VERSION,

    exportedAt:
      new Date()
        .toISOString(),

    state,
  }

  return JSON.stringify(
    backup,
    null,
    2,
  )
}

/* =========================
   BACKUP VALIDATION
========================= */

function isObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function hasValidBackupCore(
  value: unknown,
): boolean {
  if (!isObject(value)) {
    return false
  }

  if (
    typeof value.initialCredits !==
      'number' ||
    !Number.isFinite(
      value.initialCredits,
    ) ||
    value.initialCredits <= 0
  ) {
    return false
  }

  if (
    !Array.isArray(
      value.managers,
    )
  ) {
    return false
  }

  if (
    !isObject(
      value.budgetDistribution,
    )
  ) {
    return false
  }

  return true
}

/* =========================
   BACKUP IMPORT
========================= */

export function parseStateBackup(
  raw: string,
): StateBackupParseResult {
  let parsed:
    unknown

  try {
    parsed =
      JSON.parse(raw)
  } catch {
    return {
      ok: false,

      error:
        'Il file non contiene JSON valido.',
    }
  }

  if (!isObject(parsed)) {
    return {
      ok: false,

      error:
        'Il file non è un backup MisterCanà valido.',
    }
  }

  const envelope =
    parsed as Partial<
      BackupEnvelope
    >

  if (
    envelope.type !==
      BACKUP_TYPE
  ) {
    return {
      ok: false,

      error:
        'Il file non è riconosciuto come backup MisterCanà.',
    }
  }

  if (
    envelope.version !==
      BACKUP_VERSION
  ) {
    return {
      ok: false,

      error:
        `Versione backup non supportata: ${String(
          envelope.version ??
            'sconosciuta',
        )}.`,
    }
  }

  if (
    typeof envelope.exportedAt !==
      'string' ||
    !envelope.exportedAt.trim()
  ) {
    return {
      ok: false,

      error:
        'Il backup non contiene una data di esportazione valida.',
    }
  }

  if (
    !hasValidBackupCore(
      envelope.state,
    )
  ) {
    return {
      ok: false,

      error:
        'Il contenuto del backup è incompleto o non valido.',
    }
  }

  try {
    const state =
      normalizeState(
        envelope.state as
          LegacyState,
      )

    return {
      ok: true,

      state,

      exportedAt:
        envelope.exportedAt,

      version:
        envelope.version,
    }
  } catch {
    return {
      ok: false,

      error:
        'Il backup non può essere normalizzato in modo sicuro.',
    }
  }
}

function normalizePmaConfiguration(
  value: unknown,
  legacyDefenseModifier: unknown,
): PmaConfiguration {
  if (
    typeof value === 'object' &&
    value !== null
  ) {
    const candidate = value as Partial<PmaConfiguration>
    const mode = candidate.mode
    const participants = candidate.participants
    if (
      (mode === 'classic' || mode === 'mantra') &&
      (participants === 8 || participants === 10 || participants === 12) &&
      typeof candidate.defenseModifier === 'boolean'
    ) {
      return { mode, participants, defenseModifier: candidate.defenseModifier }
    }
  }
  return {
    ...structuredClone(defaultState.pmaConfiguration),
    defenseModifier:
      typeof legacyDefenseModifier === 'boolean'
        ? legacyDefenseModifier
        : defaultState.pmaConfiguration.defenseModifier,
  }
}
