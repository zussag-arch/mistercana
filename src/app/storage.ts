import type {
  AppState,
  AuctionPhase,
  Manager,
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
    >
  > & {
    auctionPhase?: unknown

    currentAuctionPlayerId?: unknown

    managers?: LegacyManager[]

    objectives?: unknown
  }

export function saveState(
  state: AppState,
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state),
  )
}

function normalizeAuctionPhase(
  phase: unknown,
): AuctionPhase {
  if (
    phase === 'completed'
  ) {
    return 'finalizing'
  }

  if (
    phase === 'setup' ||
    phase === 'live' ||
    phase === 'finalizing' ||
    phase === 'archived' ||
    phase === 'discarded'
  ) {
    return phase
  }

  return 'setup'
}

function normalizeCurrentAuctionPlayerId(
  value: unknown,
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const clean =
    value.trim()

  return clean
    ? clean
    : null
}

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
        ? manager.id
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

      if (
        seenPlayerIds.has(
          candidate.playerId,
        )
      ) {
        return
      }

      seenPlayerIds.add(
        candidate.playerId,
      )

      objectives.push({
        playerId:
          candidate.playerId,

        priority:
          candidate.priority,

        /*
          Fino alla fase algoritmi
          manteniamo sempre il
          placeholder neutro a 1.
        */
        weight: 1,
      })
    },
  )

  return objectives
}

export function loadState(): AppState {
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

    return {
      auctionPhase:
        normalizeAuctionPhase(
          parsed.auctionPhase,
        ),

      currentAuctionPlayerId:
        normalizeCurrentAuctionPlayerId(
          parsed.currentAuctionPlayerId,
        ),

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
  } catch {
    return structuredClone(
      defaultState,
    )
  }
}