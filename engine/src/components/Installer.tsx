import { v4 as uuid } from 'uuid'
import { pick } from 'lodash'

import React, { useContext, useEffect, useRef } from 'react'
import { useQuery } from 'react-query'
import { useLiveQuery } from 'dexie-react-hooks'

import { LibraryDatabase } from '../lib/db'

import {
  getWorldInfo,
  removeWorldData,
  resetWorld,
  saveEngineCollectionData,
  saveEngineDefaultWorldCollectionData
} from '../lib/api'

import { WorldId, StudioId, ESGEngineCollectionData } from '../types'

import { EngineContext, ENGINE_ACTION_TYPE } from '../contexts/EngineContext'
import { INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY } from '../lib'

const Installer: React.FC<{
  studioId: StudioId
  worldId: WorldId
  data?: ESGEngineCollectionData
  isComposer: boolean
}> = React.memo(({ children, studioId, worldId, data, isComposer }) => {
  const { engine, engineDispatch } = useContext(EngineContext)

  useQuery(
    [`installed-${engine.installId}`, engine.installed],
    async () => {
      try {
        if (!engine.installed) {
          if (!isComposer && data) {
            const database = new LibraryDatabase(studioId)

            // feedback#95
            database.on('ready', async () => {
              const updateStory = await saveEngineCollectionData(data, false)

              if (updateStory) {
                engineDispatch({
                  type: ENGINE_ACTION_TYPE.SET_UPDATE_WORLD,
                  updating: true
                })

                await removeWorldData(studioId, worldId)
                await saveEngineCollectionData(data, true)

                engineDispatch({
                  type: ENGINE_ACTION_TYPE.SET_UPDATE_WORLD,
                  updating: false
                })
              }
            })

            await database.open()
          }

          if (isComposer) {
            engineDispatch({ type: ENGINE_ACTION_TYPE.SET_IS_COMPOSER })
            engineDispatch({ type: ENGINE_ACTION_TYPE.HIDE_ERROR_NOTIFICATION })

            // #421
            const foundWorld = await getWorldInfo(studioId, worldId)

            if (foundWorld) {
              await resetWorld(studioId, worldId, true, true)
              await saveEngineDefaultWorldCollectionData(
                studioId,
                worldId,
                foundWorld.version
              )

              if (engine.playing) {
                // #422: set this before install completes to prevent
                // event stream from using old version
                // TODO: this is set again after install
                engineDispatch({
                  type: ENGINE_ACTION_TYPE.SET_WORLD_INFO,
                  gameInfo: foundWorld
                })

                engineDispatch({
                  type: ENGINE_ACTION_TYPE.SET_CURRENT_LIVE_EVENT,
                  id: `${INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY}${worldId}`
                })
              }
            } else {
              throw 'Unable to find world during install.'
            }
          }

          engineDispatch({
            type: ENGINE_ACTION_TYPE.SET_INSTALLED,
            installed: true
          })

          engineDispatch({
            type: ENGINE_ACTION_TYPE.SET_INSTALL_ID,
            id: uuid()
          })
        }

        return true
      } catch (error) {
        throw error
      }
    },
    { enabled: !engine.installed }
  )

  /*
   * A live query rather than a one-shot read.
   *
   * This used to run once, on `[engine.installed]`, which is right for an exported
   * PWA — the world it ships is fixed — and wrong in the composer, where the author
   * is editing the very record this reads. Translating a word and watching the
   * preview go on saying "Take" is the visible half; the storyworld title,
   * description, copyright and website in the settings panel were equally stale and
   * had been since before this.
   *
   * `getWorldInfo` reads through Dexie, so `useLiveQuery` re-runs it on any write to
   * the table. Costing one subscription for the whole engine is what makes it
   * affordable to keep the interface text on the context instead of querying it
   * once per rendered label.
   */
  const worldInfo = useLiveQuery(
    async () => (engine.installed ? await getWorldInfo(studioId, worldId) : undefined),
    [studioId, worldId, engine.installed]
  )

  /*
   * The last thing dispatched, so an unchanged world does not re-render every
   * consumer of EngineContext. Dexie re-runs a live query on any write to the
   * table, which includes a write to a *different* world in the same studio, and
   * it does not compare the result it hands back.
   */
  const lastDispatched = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!worldInfo) return

    // both branches name interfaceText: a field missing from either arrives
    // undefined at runtime, and the symptom for this one is a world that quietly
    // speaks English rather than an error
    const gameInfo = studioId
      ? {
          studioId, // games in editor database does not have studioId
          ...pick(worldInfo, [
            'copyright',
            'description',
            'designer',
            'id',
            'interfaceText',
            'studioTitle',
            'title',
            'updated',
            'version',
            'website'
          ])
        }
      : pick(worldInfo, [
          'copyright',
          'description',
          'designer',
          'id',
          'interfaceText',
          'studioId',
          'studioTitle',
          'title',
          'updated',
          'version',
          'website'
        ])

    const serialized = JSON.stringify(gameInfo)

    if (serialized === lastDispatched.current) return

    lastDispatched.current = serialized

    engineDispatch({
      type: ENGINE_ACTION_TYPE.SET_WORLD_INFO,
      gameInfo
    })
  }, [worldInfo, studioId, engineDispatch])

  return <>{engine.installed && children}</>
})

Installer.displayName = 'Installer'

export default Installer
