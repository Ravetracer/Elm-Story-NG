import { useMemo } from 'react'

import { ElementId, StudioId, WorldId } from '../data/types'

import { collectVariableUsage, VariableUsage } from '../lib/variableUsage'

import useEvents from './useEvents'
import useInputs from './useInputs'
import usePathConditions from './usePathConditions'
import usePathEffects from './usePathEffects'
import usePaths from './usePaths'
import useVariables from './useVariables'

/**
 * Every use of every variable in a storyworld, keyed by variable id.
 *
 * Five live queries rather than a query per variable: the content half has to
 * read every event's document anyway, and one pass over the world is cheaper than
 * one per row. Returns undefined until the queries have resolved, so a caller can
 * tell "still loading" from "genuinely unused" — the difference matters when the
 * answer gates a destructive confirmation.
 */
const useVariableUsage = (
  studioId: StudioId,
  worldId: WorldId
): Map<ElementId, VariableUsage[]> | undefined => {
  const variables = useVariables(studioId, worldId, [studioId, worldId]),
    conditions = usePathConditions(studioId, worldId, [studioId, worldId]),
    effects = usePathEffects(studioId, worldId, [studioId, worldId]),
    inputs = useInputs(studioId, worldId, [studioId, worldId]),
    events = useEvents(studioId, worldId, [studioId, worldId]),
    paths = usePaths(studioId, worldId, [studioId, worldId])

  return useMemo(() => {
    if (!variables || !conditions || !effects || !inputs || !events || !paths)
      return undefined

    return collectVariableUsage(variables, {
      conditions,
      effects,
      inputs,
      events,
      paths
    })
  }, [variables, conditions, effects, inputs, events, paths])
}

export default useVariableUsage
