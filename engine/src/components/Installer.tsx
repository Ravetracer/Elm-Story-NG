import { v4 as uuid } from 'uuid'
import { pick } from 'lodash'

import React, { useContext, useEffect, useRef } from 'react'
import { useQuery } from 'react-query'
import { useLiveQuery } from 'dexie-react-hooks'

import { getLibraryDatabase } from '../lib/db'

import {
  getWorldInfo,
  removeWorldData,
  resetWorld,
  saveEngineCollectionData,
  saveEngineDefaultWorldCollectionData
} from '../lib/api'

import {
  WorldId,
  StudioId,
  ESGEngineCollectionData,
  EngineWorldData
} from '../types'

import { EngineContext, ENGINE_ACTION_TYPE } from '../contexts/EngineContext'
import { INITIAL_LIVE_ENGINE_EVENT_ORIGIN_KEY } from '../lib'

/**
 * The fields the engine carries as `worldInfo`, and the one place they are named.
 *
 * Both writers go through this, which they did not before, and the difference was
 * not cosmetic: the install path dispatched the **raw world record** while the
 * live query below dispatched a `pick` of it with `studioId` grafted on. A world
 * row in the editor's database has no `studioId` of its own — the id is in the
 * *database name* — so installing over a running preview replaced a good
 * `worldInfo` with one whose `studioId` was `undefined`.
 *
 * Nothing threw. `LiveEventStream` destructures `studioId` off `worldInfo` and
 * guards on it before refilling the event stream, so the stream simply stopped
 * being refilled, and the preview kept rendering live events whose records had
 * just been deleted — a blank storyteller that no further interaction could
 * recover, because `lastDispatched` then saw an unchanged world and declined to
 * dispatch the repaired copy. Restarting the app was the only way out.
 *
 * A field added here reaches the engine; a field left out is `undefined` at
 * runtime with no error, which is how `interfaceText` was once quietly lost.
 */
const WORLD_INFO_FIELDS = [
  'choicePresentation',
  'copyright',
  'coverAssetId',
  'description',
  'designer',
  'id',
  'interfaceText',
  'studioTitle',
  'title',
  'updated',
  'version',
  'website'
] as const

/**
 * `studioId` is passed in rather than read off the world in the composer, and read
 * off the world in an exported PWA, where the packed collection carries it.
 */
const toEngineWorldInfo = (world: EngineWorldData, studioId?: StudioId) =>
  studioId
    ? { studioId, ...pick(world, [...WORLD_INFO_FIELDS]) }
    : pick(world, [...WORLD_INFO_FIELDS, 'studioId'])

const Installer: React.FC<{
  studioId: StudioId
  worldId: WorldId
  data?: ESGEngineCollectionData
  isComposer: boolean
}> = React.memo(({ children, studioId, worldId, data, isComposer }) => {
  const { engine, engineDispatch } = useContext(EngineContext)

  /*
   * The last thing dispatched, so an unchanged world does not re-render every
   * consumer of EngineContext. Dexie re-runs a live query on any write to the
   * table, which includes a write to a *different* world in the same studio, and
   * it does not compare the result it hands back.
   *
   * Declared above the install query because that query writes it too: the two
   * writers of `worldInfo` have to agree on what was last sent, or the guard below
   * suppresses the very dispatch that would repair a bad one.
   */
  const lastDispatched = useRef<string | undefined>(undefined)

  useQuery(
    [`installed-${engine.installId}`, engine.installed],
    async () => {
      try {
        if (!engine.installed) {
          if (!isComposer && data) {
            const database = getLibraryDatabase(studioId)

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
                const gameInfo = toEngineWorldInfo(foundWorld, studioId)

                /*
                 * Recorded as dispatched so the live query below does not send an
                 * identical copy a moment later — and, more importantly, so the
                 * two can never disagree about what was last sent. This branch
                 * only runs on a re-install over a *playing* preview, which is
                 * why the whole failure was invisible on first open.
                 */
                lastDispatched.current = JSON.stringify(gameInfo)

                engineDispatch({
                  type: ENGINE_ACTION_TYPE.SET_WORLD_INFO,
                  gameInfo
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

  useEffect(() => {
    if (!worldInfo) return

    const gameInfo = toEngineWorldInfo(worldInfo, studioId)

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
