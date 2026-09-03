import type { PmaConfiguration } from '../app/state'
import type { FldaPlayer } from '../services/flda'

export function getFldaPma(
  player: FldaPlayer,
  configuration: PmaConfiguration,
): number | undefined {
  const modifier = configuration.mode === 'classic'
    ? configuration.defenseModifier ? '_mod' : '_no_mod'
    : ''
  const key = `${configuration.mode}_${configuration.participants}${modifier}_median_value`
  const value = player[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
