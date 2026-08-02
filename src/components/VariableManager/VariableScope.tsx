import React, { useCallback, useMemo } from 'react'

import { ElementId, StudioId, VARIABLE_SCOPE, WorldId } from '../../data/types'

import { Select, Tooltip } from 'antd'

import { useScenes } from '../../hooks'

import api from '../../api'

import styles from './styles.module.less'

/**
 * How long a variable keeps its value.
 *
 * `SCENE` means exactly one thing, per `DESIGN.md` §11 — the variable returns to
 * its initial value **when the player enters that scene** — so it is per-scene
 * scratch state, and the point of it is that an author does not have to remember to
 * reset it on every way in. Everything else is world-scoped and lasts the
 * playthrough, which is what an absent scope means and therefore what every
 * variable written before this has.
 *
 * **Scope changes lifetime, not namespace.** Two scene-scoped variables in
 * different scenes still may not share a title, because template expressions
 * resolve a variable by title rather than by id — the manager's duplicate-title
 * warning stays exactly as strict. That is stated in the tooltip rather than left
 * for an author to discover, since "scoped" strongly implies a private namespace in
 * most languages and here it does not.
 *
 * Choosing SCENE without naming one leaves it inert rather than guessing: the reset
 * matches on `scopeId`, so a scope with no scene resets nothing. The select for the
 * scene therefore appears immediately and defaults to nothing chosen.
 */
const VariableScope: React.FC<{
  studioId: StudioId
  worldId: WorldId
  variableId: ElementId
  scope?: VARIABLE_SCOPE
  scopeId?: ElementId
}> = ({ studioId, worldId, variableId, scope, scopeId }) => {
  const scenes = useScenes(studioId, worldId, [studioId, worldId])

  const sceneOptions = useMemo(
    () =>
      (scenes ?? []).map((scene) => ({
        label: scene.title,
        value: scene.id as ElementId
      })),
    [scenes]
  )

  const save = useCallback(
    async (nextScope: VARIABLE_SCOPE, nextScopeId?: ElementId) =>
      await api().variables.saveVariableScope(
        studioId,
        variableId,
        nextScope,
        // a world-scoped variable has no scene, and leaving a stale one behind
        // would resurrect the old scope the moment SCENE was chosen again
        nextScope === VARIABLE_SCOPE.SCENE ? nextScopeId : undefined
      ),
    [studioId, variableId]
  )

  return (
    <div className={styles.scope}>
      <Tooltip
        title="World lasts the whole playthrough. Scene resets the variable to its initial value each time the player enters that scene. Scope changes how long a value lives, not whether the title has to be unique — expressions still resolve a variable by title."
        mouseEnterDelay={0.5}
      >
        <span className={styles.scopeLabel}>Scope</span>
      </Tooltip>

      <Select
        className={styles.scopeSelect}
        size="small"
        value={scope ?? VARIABLE_SCOPE.WORLD}
        onChange={(nextScope) => save(nextScope, scopeId)}
        options={[
          { label: 'World', value: VARIABLE_SCOPE.WORLD },
          { label: 'Scene', value: VARIABLE_SCOPE.SCENE }
        ]}
      />

      {scope === VARIABLE_SCOPE.SCENE && (
        <Select
          className={styles.scopeSceneSelect}
          size="small"
          value={scopeId}
          placeholder="Which scene?"
          onChange={(nextScopeId) =>
            save(VARIABLE_SCOPE.SCENE, nextScopeId)
          }
          options={sceneOptions}
        />
      )}
    </div>
  )
}

VariableScope.displayName = 'VariableScope'

export default VariableScope
