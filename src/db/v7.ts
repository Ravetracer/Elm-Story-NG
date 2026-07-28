// #373
import Dexie from 'dexie'

import {
  EngineBookmarkData,
  EngineGameData,
  EngineEventData
} from '../lib/transport/types/0.5.1'
import { LIBRARY_TABLE } from '.'

// Must match editor version
export default (database: Dexie) => {
  database
    .version(7)
    .stores({
      bookmarks: '&id,gameId,event,updated,version',
      events:
        '&id,gameId,destination,origin,prev,next,type,updated,[gameId+updated],version'
    })
    .upgrade(async (tx) => {
      try {
        const bookmarksTable = tx.table<EngineBookmarkData, string>(
            LIBRARY_TABLE.BOOKMARKS
          ),
          // At version 7 this table is still called `games`; v8 copies it into
          // `worlds` and v9 drops it, so LIBRARY_TABLE has no member for it any
          // more. The name has to stay a literal, exactly as v8 does when it
          // reads `tx.table('games')` — resolving it to WORLDS would read the
          // wrong table when an existing library actually upgrades through v7.
          gamesTable = tx.table<EngineGameData, string>('games'),
          eventsTable = tx.table<EngineEventData, string>(LIBRARY_TABLE.EVENTS)

        const games = await gamesTable.toCollection().toArray()

        await Promise.all([
          bookmarksTable.toCollection().modify((bookmark) => {
            const foundGame = games.find((game) => game.id === bookmark.gameId)

            bookmark.version = foundGame?.version || '0.0.0'
          }),

          eventsTable.toCollection().modify((event) => {
            const foundGame = games.find((game) => game.id === event.gameId)

            event.version = foundGame?.version || '0.0.0'
          })
        ])
      } catch (error) {
        throw error
      }
    })
}
