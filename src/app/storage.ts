import type {
  AppState,
  AuctionPhase,
  Manager,
} from './state'

import {
  defaultState,
} from './state'

const STORAGE_KEY =
  'mistercana_app_state_v1'

type LegacyManager = Partial<Manager> & {
  name?: unknown
}

type LegacyState =
  Partial<Omit<AppState, 'managers' | 'auctionPhase'>> & {
    auctionPhase?: unknown
    managers?: LegacyManager[]
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
  /*
    Migrazione delle versioni precedenti.

    Il vecchio stato "completed"
    corrisponde ora a "finalizing":
    l'utente deve decidere se
    registrare o scartare l'asta.
  */

  if (phase === 'completed') {
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

  /*
    Qualsiasi valore non riconosciuto
    torna in setup invece di lasciare
    la Dashboard bloccata.
  */
  return 'setup'
}

function splitLegacyName(
  value: string,
): {
  firstName: string
  lastName: string
} {
  const clean = value.trim()

  if (!clean) {
    return {
      firstName: 'Allenatore',
      lastName: '',
    }
  }

  const parts = clean.split(/\s+/)

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function migrateManager(
  manager: LegacyManager,
  index: number,
): Manager {
  let firstName =
    typeof manager.firstName === 'string'
      ? manager.firstName.trim()
      : ''

  let lastName =
    typeof manager.lastName === 'string'
      ? manager.lastName.trim()
      : ''

  /*
    Compatibilità con il vecchio
    campo "name".
  */
  if (
    !firstName &&
    typeof manager.name === 'string'
  ) {
    const migrated =
      splitLegacyName(manager.name)

    firstName = migrated.firstName
    lastName = migrated.lastName
  }

  if (!firstName) {
    firstName = 'Allenatore'
  }

  return {
    id:
      typeof manager.id === 'string' &&
      manager.id.trim()
        ? manager.id
        : `manager_migrated_${index}`,

    firstName,

    lastName,

    alias:
      typeof manager.alias === 'string'
        ? manager.alias.trim()
        : '',

    teamName:
      typeof manager.teamName === 'string'
        ? manager.teamName.trim()
        : '',

    isOwner:
      typeof manager.isOwner === 'boolean'
        ? manager.isOwner
        : false,

    active:
      typeof manager.active === 'boolean'
        ? manager.active
        : true,

    archived:
      typeof manager.archived === 'boolean'
        ? manager.archived
        : false,
  }
}

export function loadState(): AppState {
  const raw =
    localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return structuredClone(defaultState)
  }

  try {
    const parsed =
      JSON.parse(raw) as LegacyState

    const managers =
      Array.isArray(parsed.managers)
        ? parsed.managers.map(
            migrateManager,
          )
        : structuredClone(
            defaultState.managers,
          )

    return {
      auctionPhase:
        normalizeAuctionPhase(
          parsed.auctionPhase,
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

      budgetProfile:
        parsed.budgetProfile ??
        defaultState.budgetProfile,

      budgetDistribution: {
        ...defaultState.budgetDistribution,
        ...parsed.budgetDistribution,
      },

      managers,
    }
  } catch {
    return structuredClone(defaultState)
  }
}