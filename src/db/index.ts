import { ipcRenderer } from 'electron'

import Dexie from 'dexie'
import logger from '../lib/logger'

import {
  Element,
  Studio,
  StudioId,
  Editor,
  World,
  WorldId,
  ElementId,
  Folder,
  Scene,
  Event,
  Choice,
  Condition,
  Effect,
  Variable,
  VARIABLE_TYPE,
  Jump,
  JumpPath,
  SET_OPERATOR_TYPE,
  COMPARE_OPERATOR_TYPE,
  FolderChildRefs,
  WorldChildRefs,
  SceneParentRef,
  SceneChildRefs,
  ELEMENT_TYPE,
  FolderParentRef,
  EVENT_TYPE,
  Input,
  Character,
  CharacterRelationship,
  ObjectCondition,
  Path,
  Recipe,
  WorldObject,
  VARIABLE_SCOPE
} from '../data/types'
import {
  EngineBookmarkData,
  EngineEventData,
  EngineSettingsData
} from '../lib/transport/types/0.5.1'
import { WINDOW_EVENT_TYPE } from '../lib/events'
import { ASSET_KIND, ASSET_KINDS } from '../lib/assets'

// DATABASE VERSIONS / UPGRADES
import v1 from './v1'
import v2 from './v2'
import v3 from './v3'
import v4 from './v4'
import v5 from './v5'
import v6 from './v6'
import v7 from './v7'
import v8 from './v8'
import v9 from './v9'
import v10 from './v10' // 0.7.0
import v11 from './v11' // 0.7.1
import v12 from './v12' // 0.8.0

import api from '../api'

export enum DB_NAME {
  APP = 'esg-app',
  LIBRARY = 'esg-library'
}

export enum APP_TABLE {
  STUDIOS = 'studios',
  EDITORS = 'editors'
}

export enum LIBRARY_TABLE {
  BOOKMARKS = 'bookmarks',
  CHARACTER_RELATIONSHIPS = 'characterRelationships',
  CHARACTERS = 'characters',
  CHOICES = 'choices',
  CONDITIONS = 'conditions',
  EFFECTS = 'effects',
  EVENTS = 'events',
  FOLDERS = 'folders',
  INPUTS = 'inputs',
  JUMPS = 'jumps',
  LIVE_EVENTS = 'live_events',
  OBJECT_CONDITIONS = 'objectConditions',
  OBJECTS = 'objects',
  PATHS = 'paths',
  RECIPES = 'recipes',
  SCENES = 'scenes',
  SETTINGS = 'settings',
  VARIABLES = 'variables',
  WORLDS = 'worlds'
}

export class AppDatabase extends Dexie {
  public studios: Dexie.Table<Studio, string>
  public editors: Dexie.Table<Editor, string>

  public constructor() {
    super(DB_NAME.APP)

    v1(this)
    v2(this)

    this.studios = this.table(APP_TABLE.STUDIOS)
    this.editors = this.table(APP_TABLE.EDITORS)
  }

  public async getComponent(table: APP_TABLE, id: ElementId): Promise<boolean> {
    let exists = false

    try {
      exists = (await this[table].where({ id }).first()) ? true : false
    } catch (error) {
      throw error
    }

    return exists
  }

  public async getStudio(studioId: StudioId): Promise<Studio | undefined> {
    try {
      return await this.studios.get(studioId)
    } catch (error) {
      throw error
    }
  }

  public async saveStudio(studio: Studio): Promise<StudioId> {
    try {
      await this.transaction('rw', this.studios, async () => {
        if (studio.id) {
          if (await this.getComponent(APP_TABLE.STUDIOS, studio.id)) {
            await this.studios.update(studio.id, {
              ...studio,
              updated: Date.now()
            })
          } else {
            await this.studios.add({
              ...studio,
              updated: studio.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save studio to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    if (studio.id) {
      return studio.id
    } else {
      throw new Error('Unable to save studio to database. Missing ID.')
    }
  }

  public async removeStudio(studioId: StudioId) {
    try {
      await this.transaction('rw', this.studios, async () => {
        if (await this.getComponent(APP_TABLE.STUDIOS, studioId)) {
          await Promise.all([
            ipcRenderer.invoke(WINDOW_EVENT_TYPE.REMOVE_ASSETS, {
              studioId,
              type: 'STUDIO'
            }),
            this.studios.delete(studioId)
          ])
        } else {
          throw new Error(
            `Unable to remove studio with ID: '${studioId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }
}

export class LibraryDatabase extends Dexie {
  public bookmarks: Dexie.Table<EngineBookmarkData, string>
  public characterRelationships: Dexie.Table<CharacterRelationship, string>
  public characters: Dexie.Table<Character, string>
  public choices: Dexie.Table<Choice, string>
  public conditions: Dexie.Table<Condition, string>
  public effects: Dexie.Table<Effect, string>
  public events: Dexie.Table<Event, string>
  public folders: Dexie.Table<Folder, string>
  public jumps: Dexie.Table<Jump, string>
  public inputs: Dexie.Table<Input, string>
  public live_events: Dexie.Table<EngineEventData, string>
  public objectConditions: Dexie.Table<ObjectCondition, string>
  public objects: Dexie.Table<WorldObject, string>
  public paths: Dexie.Table<Path, string>
  public recipes: Dexie.Table<Recipe, string>
  public scenes: Dexie.Table<Scene, string>
  public settings: Dexie.Table<EngineSettingsData, string>
  public variables: Dexie.Table<Variable, string>
  public worlds: Dexie.Table<World, string>

  public studioId: StudioId

  public constructor(studioId: StudioId) {
    super(`${DB_NAME.LIBRARY}-${studioId}`)

    v1(this)
    v2(this)
    v3(this)
    v4(this)
    v5(this)
    v6(this)
    v7(this)
    v8(this)
    v9(this)
    v10(this)
    v11(this)
    v12(this)

    this.tables.map((table) => table.name)

    this.bookmarks = this.table(LIBRARY_TABLE.BOOKMARKS)
    this.characterRelationships = this.table(
      LIBRARY_TABLE.CHARACTER_RELATIONSHIPS
    )
    this.characters = this.table(LIBRARY_TABLE.CHARACTERS)
    this.choices = this.table(LIBRARY_TABLE.CHOICES)
    this.conditions = this.table(LIBRARY_TABLE.CONDITIONS)
    this.effects = this.table(LIBRARY_TABLE.EFFECTS)
    this.events = this.table(LIBRARY_TABLE.EVENTS)
    this.folders = this.table(LIBRARY_TABLE.FOLDERS)
    this.inputs = this.table(LIBRARY_TABLE.INPUTS)
    this.jumps = this.table(LIBRARY_TABLE.JUMPS)
    this.live_events = this.table(LIBRARY_TABLE.LIVE_EVENTS)
    this.objectConditions = this.table(LIBRARY_TABLE.OBJECT_CONDITIONS)
    this.objects = this.table(LIBRARY_TABLE.OBJECTS)
    this.paths = this.table(LIBRARY_TABLE.PATHS)
    this.recipes = this.table(LIBRARY_TABLE.RECIPES)
    this.scenes = this.table(LIBRARY_TABLE.SCENES)
    this.settings = this.table(LIBRARY_TABLE.SETTINGS)
    this.variables = this.table(LIBRARY_TABLE.VARIABLES)
    this.worlds = this.table(LIBRARY_TABLE.WORLDS)

    this.studioId = studioId
  }

  public async getElement(table: LIBRARY_TABLE, id: ElementId) {
    let element = undefined

    try {
      element = (await this[table].where({ id }).first()) || undefined
    } catch (error) {
      throw error
    }

    return element
  }

  public async getElementsByWorldRef(worldId: WorldId, table: LIBRARY_TABLE) {
    try {
      return await this[table].where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveElementTitle(
    elementId: ElementId,
    table: LIBRARY_TABLE,
    title: string
  ) {
    try {
      await this.transaction('rw', this[table], async () => {
        if (elementId) {
          const element = await this.getElement(table, elementId)

          if (element) {
            /*
             * Narrowed deliberately. `this[table]` is a union over every table's
             * row type, and `update()` with a spread produces a union of the
             * update shapes — which tipped over TS2590 ("union type that is too
             * complex to represent") when 0.8.0 took the table count from 15 to
             * 19. Every row type here extends `Element` and the only fields
             * written are `title` and `updated`, both declared on `Element`, so
             * the cast is sound rather than a suppression.
             */
            await (this[table] as Dexie.Table<Element, string>).update(
              elementId,
              {
                ...element,
                title,
                updated: Date.now()
              }
            )
          } else {
            throw new Error('Unable to rename element. Component missing.')
          }
        } else {
          throw new Error('Unable to rename element. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getCharacter(characterId: ElementId) {
    try {
      const character = await this.characters.get(characterId)

      if (!character)
        logger.error(
          `Unable to get character with ID: ${characterId}. Does not exist.`
        )
      return character
    } catch (error) {
      throw error
    }
  }

  public async getCharactersByWorldRef(worldId: WorldId): Promise<Character[]> {
    try {
      return await this.characters.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveCharacter(character: Character) {
    if (!character.worldId)
      throw new Error('Unable to save character to database. Missing game ID.')
    if (!character.id)
      throw new Error('Unable to save character to database. Missing ID.')

    try {
      await this.transaction('rw', this.characters, async () => {
        if (character.id) {
          if (await this.getElement(LIBRARY_TABLE.CHARACTERS, character.id)) {
            await this.characters.update(character.id, {
              ...character,
              updated: Date.now()
            })
          } else {
            await this.characters.add({
              ...character,
              updated: character.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save character to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return character
  }

  public async removeCharacter(studioId: StudioId, characterId: ElementId) {
    logger.info(`LibraryDatabase->removeCharacter`)

    // TODO: consider dependencies e.g. passages

    try {
      /*
       * Collected inside the transaction and trashed after it. Two things were
       * wrong with doing it inline: `Promise.all` was given an array *of arrays*
       * and so resolved without awaiting anything inside them, making the
       * removals fire-and-forget; and the mask images were removed outright,
       * without counting, when two masks are allowed to name one image.
       */
      let deadMaskAssets: { assetId: string; worldId: WorldId }[] = []

      /*
       * 0.8.0: a relationship is an edge, so losing either end makes it
       * meaningless. Removed before the character, since it is read by character
       * id. The pre-existing gap noted in `TODO.md` — content character-reference
       * nodes and `CharacterRefs` are still not cascaded — is untouched here.
       */
      const relationships = await this.getCharacterRelationshipsByCharacterRef(
        characterId
      )

      for (const relationship of relationships) {
        relationship.id &&
          (await this.removeCharacterRelationship(relationship.id))
      }

      await this.transaction('rw', this.characters, async () => {
        const character = await this.characters.get(characterId)

        if (character) {
          logger.info(
            `LibraryDatabase->removeCharacter->Removing character with ID: ${characterId}`
          )

          deadMaskAssets = character.masks
            .filter((mask) => mask.assetId)
            .map((mask) => ({
              assetId: mask.assetId as string,
              worldId: character.worldId
            }))

          await this.characters.delete(characterId)
        } else {
          logger.error(
            `LibraryDatabase->removeCharacter->Unable to remove character with ID: '${characterId}'. Does not exist.`
          )
        }
      })

      // sequentially, so each count sees what the one before it trashed
      for (const { assetId, worldId } of deadMaskAssets) {
        await api().assets.removeAssetIfUnreferenced(
          studioId,
          worldId,
          assetId,
          'jpeg'
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getWorld(worldId: WorldId): Promise<World> {
    try {
      const world = await this.worlds.get(worldId)

      if (world) {
        return world
      } else {
        throw new Error(
          `Unable to get world with ID: ${worldId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async saveWorld(world: World): Promise<World> {
    if (!world.id)
      throw new Error('Unable to save world to database. Missing ID.')

    try {
      await this.transaction('rw', this.worlds, async () => {
        if (world.id) {
          if (await this.getElement(LIBRARY_TABLE.WORLDS, world.id)) {
            await this.worlds.update(world.id, {
              ...world,
              updated: Date.now()
            })
          } else {
            await this.worlds.add({
              ...world,
              updated: world.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save world to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return world
  }

  public async saveChildRefsToWorld(
    worldId: WorldId,
    children: WorldChildRefs
  ) {
    try {
      await this.transaction('rw', this.worlds, async () => {
        if (worldId) {
          const world = await this.getElement(LIBRARY_TABLE.WORLDS, worldId)

          if (world) {
            this.worlds.update(worldId, {
              ...world,
              children,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save child refs. World missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveJumpRefToWorld(worldId: WorldId, jumpId: ElementId | null) {
    try {
      await this.transaction('rw', this.worlds, async () => {
        if (worldId) {
          const world = await this.getElement(LIBRARY_TABLE.WORLDS, worldId)

          if (world) {
            this.worlds.update(worldId, {
              ...world,
              jump: jumpId,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save jump ref. Game missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removeWorld(studioId: StudioId, worldId: WorldId) {
    if (!studioId) throw 'Unable to remove world. Missing studio ID.'
    if (!worldId) throw new Error('Unable to remove world. Missing game ID.')

    try {
      logger.info(`Removing world with ID: ${worldId}`)

      // TODO: replace 'delete' method with methods that handle children
      await Promise.all([
        ipcRenderer.invoke(WINDOW_EVENT_TYPE.REMOVE_ASSETS, {
          studioId,
          worldId,
          type: 'GAME'
        }),
        this.bookmarks.where({ worldId }).delete(),
        this.characters.where({ worldId }).delete(),
        this.choices.where({ worldId }).delete(),
        this.conditions.where({ worldId }).delete(),
        this.effects.where({ worldId }).delete(),
        this.events.where({ worldId }).delete(),
        this.folders.where({ worldId }).delete(),
        this.inputs.where({ worldId }).delete(),
        this.jumps.where({ worldId }).delete(),
        this.live_events.where({ worldId }).delete(),
        this.paths.where({ worldId }).delete(),
        this.settings.where({ worldId }).delete(),
        this.scenes.where({ worldId }).delete(),
        this.variables.where({ worldId }).delete()
      ])

      await this.transaction('rw', this.worlds, async () => {
        if (await this.getElement(LIBRARY_TABLE.WORLDS, worldId)) {
          await this.worlds.delete(worldId)
        } else {
          throw new Error(
            `Unable to remove world with ID: '${worldId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getFolder(folderId: ElementId): Promise<Folder> {
    try {
      const folder = await this.folders.get(folderId)

      if (folder) {
        return folder
      } else {
        throw new Error(
          `Unable to get folder with ID: ${folderId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async saveFolder(folder: Folder): Promise<ElementId> {
    if (!folder.worldId)
      throw new Error('Unable to save folder to database. Missing world ID.')
    if (!folder.id)
      throw new Error('Unable to save folder to database. Missing ID.')

    try {
      await this.transaction('rw', this.folders, async () => {
        if (folder.id) {
          if (await this.getElement(LIBRARY_TABLE.FOLDERS, folder.id)) {
            await this.folders.update(folder.id, {
              ...folder,
              updated: Date.now()
            })
          } else {
            await this.folders.add({
              ...folder,
              updated: folder.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save folder to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return folder.id
  }

  public async saveParentRefToFolder(
    parent: FolderParentRef,
    folderId: ElementId
  ) {
    try {
      const folder = await this.getElement(LIBRARY_TABLE.FOLDERS, folderId)

      if (folder && folder.id) {
        await this.folders.update(folder.id, {
          ...folder,
          parent,
          updated: Date.now()
        })
      } else {
        throw new Error('Unable to save parent ref. Missing folder.')
      }
    } catch (error) {
      throw error
    }
  }

  public async saveChildRefsToFolder(
    folderId: ElementId,
    children: FolderChildRefs
  ) {
    try {
      await this.transaction('rw', this.folders, async () => {
        if (folderId) {
          const folder = await this.getElement(LIBRARY_TABLE.FOLDERS, folderId)

          if (folder) {
            this.folders.update(folderId, {
              ...folder,
              children,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save child refs. Folder missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removeFolder(folderId: ElementId) {
    let children: [ELEMENT_TYPE, ElementId][] = []

    const getChildren = async (itemId: ElementId, type: ELEMENT_TYPE) => {
      let item: Folder | Scene | undefined = undefined

      switch (type) {
        case ELEMENT_TYPE.FOLDER:
          item = await this.folders.where({ id: itemId }).first()
          break
        case ELEMENT_TYPE.SCENE:
          item = await this.scenes.where({ id: itemId }).first()
          break
        default:
          break
      }

      if (item && item.children.length > 0) {
        children = [...children, ...item.children]

        await Promise.all(
          item.children.map(async (child) => {
            await getChildren(child[1], child[0])
          })
        )
      }
    }

    try {
      await getChildren(folderId, ELEMENT_TYPE.FOLDER)

      logger.info(
        `removeFolder->Removing ${
          children.filter((child) => child[0] === ELEMENT_TYPE.FOLDER).length
        } nested folder(s) from folder with ID: ${folderId}`
      )

      logger.info(
        `removeFolder->Removing ${
          children.filter((child) => child[0] === ELEMENT_TYPE.SCENE).length
        } nested scene(s) from folder with ID: ${folderId}`
      )

      logger.info(
        `removeFolder->Removing ${
          children.filter((child) => child[0] === ELEMENT_TYPE.EVENT).length
        } nested event(s) from folder with ID: ${folderId}`
      )

      await Promise.all(
        children.map(async (child) => {
          switch (child[0]) {
            case ELEMENT_TYPE.FOLDER:
              await this.folders.delete(child[1])
              break
            case ELEMENT_TYPE.SCENE:
              await this.removeScene(child[1])
              break
            case ELEMENT_TYPE.EVENT:
              await this.removeEvent(child[1])
              break
            default:
              break
          }
        })
      )

      await this.transaction('rw', this.folders, async () => {
        if (await this.getElement(LIBRARY_TABLE.FOLDERS, folderId)) {
          logger.info(`Removing folder with ID: ${folderId}`)

          await this.folders.delete(folderId)
        } else {
          throw new Error(
            `Unable to remove folder with ID: '${folderId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }

    return
  }

  public async getFoldersByWorldRef(worldId: WorldId): Promise<Folder[]> {
    try {
      return await this.folders.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getChildRefsByFolderRef(
    folderId: ElementId
  ): Promise<FolderChildRefs> {
    try {
      const folder = await this.folders.where({ id: folderId }).first()

      if (folder) {
        return folder.children
      } else {
        throw new Error('Folder not found.')
      }
    } catch (error) {
      throw error
    }
  }

  public async getJump(jumpId: ElementId): Promise<Jump> {
    try {
      const jump = await this.jumps.get(jumpId)

      if (jump) {
        return jump
      } else {
        throw new Error(
          `Unable to get jump with ID: ${jumpId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getJumpsByWorldRef(worldId: WorldId): Promise<Jump[]> {
    try {
      return await this.jumps.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveJump(jump: Jump): Promise<Jump> {
    if (!jump.worldId)
      throw new Error('Unable to save jump to database. Missing game ID.')
    if (!jump.id)
      throw new Error('Unable to save jump to database. Missing ID.')

    try {
      await this.transaction('rw', this.jumps, async () => {
        if (jump.id) {
          if (await this.getElement(LIBRARY_TABLE.JUMPS, jump.id)) {
            await this.jumps.update(jump.id, { ...jump, updated: Date.now() })
          } else {
            await this.jumps.add({
              ...jump,
              updated: jump.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save jump to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return jump
  }

  public async saveJumpPath(jumpId: ElementId, path: JumpPath) {
    logger.info(
      `LibraryDatabase->saveJumpPath->jumpId: ${jumpId} path: ${path}`
    )

    try {
      await this.transaction('rw', this.jumps, async () => {
        if (jumpId) {
          const jump = await this.getElement(LIBRARY_TABLE.JUMPS, jumpId)

          if (jump) {
            this.jumps.update(jumpId, { ...jump, path, updated: Date.now() })
          } else {
            throw new Error('Unable to save jump path. Jump missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveSceneRefToJump(sceneId: ElementId, jumpId: ElementId) {
    logger.info(
      `LibraryDatabase->saveSceneRefToJump->scene: ${sceneId}->jump: ${jumpId}`
    )

    try {
      const jump = await this.getElement(LIBRARY_TABLE.JUMPS, jumpId)

      if (jump && jump.id) {
        await this.jumps.update(jump.id, {
          ...jump,
          sceneId,
          updated: Date.now()
        })
      } else {
        throw new Error('Unable to save scene ID. Missing jump.')
      }
    } catch (error) {
      throw error
    }
  }

  public async removeJump(
    jumpId: ElementId,
    skipDestinationPaths: boolean = false
  ) {
    logger.info(`LibraryDatabase->removeJump:${jumpId}`)

    try {
      if (!skipDestinationPaths) {
        const paths = await this.paths
          .where({ destinationId: jumpId })
          .toArray()

        logger.info(
          `removeJump->Removing ${paths.length} path(s) from jump with ID: ${jumpId}`
        )

        await Promise.all(
          paths.map(async (path) => path.id && (await this.removePath(path.id)))
        )
      }
    } catch (error) {
      throw error
    }

    try {
      const jump: Jump | undefined = await this.jumps.get(jumpId)

      if (jump?.sceneId) {
        const updatedSceneChildRefs: SceneChildRefs =
            (await this.scenes.get(jump.sceneId))?.children || [],
          foundJumpIndex = updatedSceneChildRefs.findIndex(
            (childRef) => childRef[1] === jump.id
          )

        if (updatedSceneChildRefs && foundJumpIndex !== -1) {
          updatedSceneChildRefs.splice(foundJumpIndex, 1)

          await this.saveChildRefsToScene(jump.sceneId, updatedSceneChildRefs)
        }
      }

      await this.transaction('rw', this.jumps, async () => {
        if (jump) {
          logger.info(
            `LibraryDatabase->removeJump->Removing jump with ID: ${jumpId}`
          )

          await this.jumps.delete(jumpId)
        } else {
          // TODO: WHY
          logger.error(
            `LibraryDatabase->removeJump->Unable to remove jump with ID: '${jumpId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getJumpsBySceneRef(sceneId: ElementId): Promise<Jump[]> {
    try {
      return await this.jumps.where({ sceneId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getJumpsByEventRef(eventId: ElementId): Promise<Jump[]> {
    try {
      return await this.jumps.where({ path: eventId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getScene(sceneId: ElementId): Promise<Scene> {
    try {
      const scene = await this.scenes.get(sceneId)

      if (scene) {
        return scene
      } else {
        throw new Error(
          `Unable to get scene with ID: ${sceneId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async saveScene(scene: Scene): Promise<ElementId> {
    if (!scene.parent)
      throw new Error('Unable to save scene to database. Missing parent.')
    if (!scene.id)
      throw new Error('Unable to save scene to database. Missing ID.')

    try {
      await this.transaction('rw', this.scenes, async () => {
        if (scene.id) {
          if (await this.getElement(LIBRARY_TABLE.SCENES, scene.id)) {
            await this.scenes.update(scene.id, {
              ...scene,
              updated: Date.now()
            })
          } else {
            await this.scenes.add({
              ...scene,
              updated: scene.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save scene to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return scene.id
  }

  public async saveParentRefToScene(
    parent: SceneParentRef,
    sceneId: ElementId
  ) {
    try {
      const scene = await this.getElement(LIBRARY_TABLE.SCENES, sceneId)

      if (scene && scene.id) {
        await this.scenes.update(scene.id, {
          ...scene,
          parent,
          updated: Date.now()
        })
      } else {
        throw new Error('Unable to save parent ref. Missing scene.')
      }
    } catch (error) {
      throw error
    }
  }

  public async saveChildRefsToScene(
    sceneId: ElementId,
    children: SceneChildRefs
  ) {
    try {
      await this.transaction('rw', this.scenes, async () => {
        if (sceneId) {
          const scene = await this.getElement(LIBRARY_TABLE.SCENES, sceneId)

          if (scene) {
            this.scenes.update(sceneId, {
              ...scene,
              children,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save event refs. Scene missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveSceneViewTransform(
    sceneId: ElementId,
    transform: { x: number; y: number; zoom: number }
  ) {
    try {
      await this.transaction('rw', this.scenes, async () => {
        if (sceneId) {
          const scene = await this.getElement(LIBRARY_TABLE.SCENES, sceneId)

          if (scene) {
            this.scenes.update(sceneId, {
              ...scene,
              composer: {
                sceneMapTransformX: transform.x,
                sceneMapTransformY: transform.y,
                sceneMapTransformZoom: transform.zoom
              },
              updated: Date.now()
            })
          } else {
            throw new Error(
              `Unable to save scene view transform. Scene missing.`
            )
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removeScene(sceneId: ElementId) {
    logger.info(`LibraryDatabase->removeScene`)

    try {
      const scene = await this.scenes.get(sceneId),
        game = scene?.id ? await this.worlds.get(scene.worldId) : undefined

      const eventIds: string[] = [],
        jumpIds: string[] = [],
        // used for world start jump and any jumps pointing to this scene
        jumpsByPath = await this.jumps.where({ path: sceneId }).toArray()

      scene?.children.map((childRef) => {
        switch (childRef[0]) {
          case ELEMENT_TYPE.EVENT:
            eventIds.push(childRef[1])
            break
          case ELEMENT_TYPE.JUMP:
            jumpIds.push(childRef[1])
            break
          default:
            break
        }
      })

      logger.info(
        `LibraryDatabase->removeScene->Removing ${eventIds.length} event(s) from scene with ID: ${sceneId}`
      )

      logger.info(
        `LibraryDatabase->removeScene->Removing ${jumpIds.length} jumps(s) from scene with ID: ${sceneId}`
      )

      // elmstorygames/feedback#131
      for (const jump of jumpsByPath) {
        game?.id &&
          jump.id === game.jump &&
          (await this.saveJumpRefToWorld(game.id, null))

        jump.id && (await this.removeJump(jump.id))
      }

      await Promise.all([
        eventIds.map(async (eventId) => await this.removeEvent(eventId)),
        jumpIds.map(async (jumpId) => await this.removeJump(jumpId))
      ])

      scene?.audio?.[0] &&
        (await ipcRenderer.invoke(WINDOW_EVENT_TYPE.REMOVE_ASSET, {
          studioId: this.studioId,
          worldId: scene.worldId,
          id: scene.audio[0],
          ext: 'mp3'
        }))

      await this.transaction('rw', this.scenes, async () => {
        if (await this.getElement(LIBRARY_TABLE.SCENES, sceneId)) {
          logger.info(
            `LibraryDatabase->removeScene->Removing scene with ID: ${sceneId}`
          )

          await this.scenes.delete(sceneId)
        } else {
          throw new Error(
            `LibraryDatabase->removeScene->Unable to remove scene with ID: '${sceneId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getScenesByWorldRef(worldId: WorldId): Promise<Scene[]> {
    try {
      return await this.scenes.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getChildRefsBySceneRef(
    sceneId: ElementId
  ): Promise<SceneChildRefs> {
    try {
      const scene = await this.scenes.where({ id: sceneId }).first()

      if (scene) {
        return scene.children
      } else {
        throw new Error('Scene not found.')
      }
    } catch (error) {
      throw error
    }
  }

  public async getPath(pathId: ElementId): Promise<Path> {
    try {
      const path = await this.paths.get(pathId)

      if (path) {
        return path
      } else {
        throw new Error(
          `Unable to get path with ID: ${pathId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getPathsByWorldRef(worldId: WorldId): Promise<Path[]> {
    try {
      return await this.paths.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async savePath(path: Path): Promise<ElementId> {
    if (!path.sceneId)
      throw new Error('Unable to save path to database. Missing scene ID.')
    if (!path.id)
      throw new Error('Unable to save path to database. Missing ID.')

    try {
      await this.transaction('rw', this.paths, async () => {
        if (path.id) {
          if (await this.getElement(LIBRARY_TABLE.PATHS, path.id)) {
            await this.paths.update(path.id, {
              ...path,
              updated: Date.now()
            })
          } else {
            await this.paths.add({
              ...path,
              updated: path.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save path to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return path.id
  }

  /**
   * The line the storyteller says when this path is taken.
   *
   * A targeted update rather than `savePath` with a spread, for the reason
   * `saveVariableDescription` is one: the field is edited by a debounced text
   * input, so the `Path` a component rendered with can be several keystrokes old
   * by the time the timer fires, and writing it back would undo whatever else
   * changed on the path meanwhile. The row is re-read inside the transaction.
   */
  public async savePathNotification(
    pathId: ElementId,
    notification: string | undefined
  ) {
    await this.transaction('rw', this.paths, async () => {
      if (pathId) {
        const component = await this.getElement(LIBRARY_TABLE.PATHS, pathId)

        if (component) {
          await this.paths.update(pathId, {
            ...component,
            // an emptied field is dropped rather than stored as '', so a path
            // that never had one and one that was cleared look alike — and an
            // exported '' would otherwise reach the engine as a message with no
            // text
            notification: notification || undefined,
            updated: Date.now()
          })
        } else {
          throw new Error('Unable to save path notification. Path missing.')
        }
      } else {
        throw new Error('Unable to save path notification. Missing path ID.')
      }
    })
  }

  public async removePath(pathId: ElementId) {
    logger.info(`LibraryDatabase->removePath`)

    try {
      const conditions = await this.conditions.where({ pathId }).toArray(),
        effects = await this.effects.where({ pathId }).toArray(),
        // 0.8.0: object gates are rows on the path too, and outlive it otherwise
        objectConditions = await this.objectConditions
          .where({ pathId })
          .toArray()

      await Promise.all([
        conditions.map(
          async (condition) =>
            condition.id && (await this.removeCondition(condition.id))
        ),
        effects.map(
          async (effect) => effect.id && (await this.removeEffect(effect.id))
        ),
        objectConditions.map(
          async (condition) =>
            condition.id && (await this.removeObjectCondition(condition.id))
        )
      ])

      await this.transaction('rw', this.paths, async () => {
        if (await this.getElement(LIBRARY_TABLE.PATHS, pathId)) {
          logger.info(
            `LibraryDatabase->removePath->Removing path with ID: ${pathId}`
          )

          await this.paths.delete(pathId)
        } else {
          // TODO: #70; async issue - we can do things in order, but this is likely more efficient
          logger.error(
            `LibraryDatabase->removePath->Unable to remove path with ID: '${pathId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removePathsByEventRef(eventId: ElementId) {
    logger.info(`LibraryDatabase->removeRoutesByEventRef`)

    try {
      const originRoutes = await this.paths
          .where({ originId: eventId })
          .toArray(),
        destinationRoutes = await this.paths
          .where({ destinationId: eventId })
          .toArray()

      await Promise.all([
        originRoutes.map(
          async (originRoute) =>
            originRoute.id && (await this.removePath(originRoute.id))
        ),
        destinationRoutes.map(
          async (destinationRoute) =>
            destinationRoute.id && (await this.removePath(destinationRoute.id))
        )
      ])
    } catch (error) {
      throw error
    }
  }

  public async removePathsByJumpRef(jumpId: ElementId) {
    logger.info(`LibraryDatabase->removeRoutesByJumpRef`)

    try {
      const destinationRoutes = await this.paths
        .where({ destinationId: jumpId })
        .toArray()

      await destinationRoutes.map(
        async (destinationRoute) =>
          destinationRoute.id && (await this.removePath(destinationRoute.id))
      )
    } catch (error) {
      throw error
    }
  }

  public async removePathsByChoiceRef(choiceId: ElementId) {
    try {
      const paths = await this.paths.where({ choiceId }).toArray()

      await Promise.all(
        paths.map(async (path) => path.id && (await this.removePath(path.id)))
      )
    } catch (error) {
      throw error
    }
  }

  public async getCondition(conditionId: ElementId): Promise<Condition> {
    try {
      const condition = await this.conditions.get(conditionId)

      if (condition) {
        return condition
      } else {
        throw new Error(
          `Unable to get condition with ID: ${conditionId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getConditionsByWorldRef(worldId: WorldId): Promise<Condition[]> {
    try {
      return await this.conditions.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getConditionsByPathRef(
    pathId: ElementId,
    countOnly?: boolean
  ): Promise<number | Condition[]> {
    try {
      return countOnly
        ? await this.conditions.where({ pathId }).count()
        : await this.conditions.where({ pathId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getConditionsByVariableRef(
    variableId: ElementId
  ): Promise<Condition[]> {
    try {
      return await this.conditions.where({ variableId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveCondition(condition: Condition): Promise<ElementId> {
    if (!condition.pathId)
      throw new Error('Unable to save condition to database. Missing path ID.')
    if (!condition.id)
      throw new Error('Unable to save condition to database. Missing ID.')

    try {
      await this.transaction('rw', this.conditions, async () => {
        if (condition.id) {
          if (await this.getElement(LIBRARY_TABLE.CONDITIONS, condition.id)) {
            await this.conditions.update(condition.id, {
              ...condition,
              updated: Date.now()
            })
          } else {
            await this.conditions.add({
              ...condition,
              updated: condition.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save condition to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return condition.id
  }

  public async saveConditionCompareOperatorType(
    condtionId: ElementId,
    newCompareOperatorType: COMPARE_OPERATOR_TYPE
  ) {
    try {
      await this.transaction('rw', this.conditions, async () => {
        if (condtionId) {
          const condition = await this.conditions
            .where({ id: condtionId })
            .first()

          if (condition) {
            await this.conditions.update(condtionId, {
              ...condition,
              compare: [
                condition.compare[0],
                newCompareOperatorType,
                condition.compare[2],
                condition.compare[3]
              ],
              updated: Date.now()
            })
          } else {
            throw new Error(
              'Unable to set condition compare operator type. Component missing.'
            )
          }
        } else {
          throw new Error(
            'Unable to set condition compare operator type. Missing ID.'
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveConditionValue(conditionId: ElementId, newValue: string) {
    try {
      await this.transaction('rw', this.conditions, async () => {
        if (conditionId) {
          const condition = await this.conditions
            .where({ id: conditionId })
            .first()

          if (condition) {
            await this.conditions.update(conditionId, {
              ...condition,
              compare: [
                condition.compare[0],
                condition.compare[1],
                newValue,
                condition.compare[3]
              ],
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to set condition value. Component missing.')
          }
        } else {
          throw new Error('Unable to set condition value. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removeCondition(conditionId: ElementId) {
    logger.info(`LibraryDatabase->removeCondition`)

    try {
      await this.transaction('rw', this.conditions, async () => {
        if (await this.getElement(LIBRARY_TABLE.CONDITIONS, conditionId)) {
          logger.info(
            `LibraryDatabase->removeCondition->Removing condition with ID: ${conditionId}`
          )

          await this.conditions.delete(conditionId)
        } else {
          // TODO: #70; async issue - we can do things in order, but this is likely more efficent
          logger.error(
            `LibraryDatabase->removeCondition->Unable to remove condition with ID: '${conditionId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getEffect(effectId: ElementId): Promise<Effect> {
    try {
      const effect = await this.effects.get(effectId)

      if (effect) {
        return effect
      } else {
        throw new Error(
          `Unable to get effect with ID: ${effectId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getEffectsByWorldRef(worldId: WorldId): Promise<Effect[]> {
    try {
      return await this.effects.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getEffectsByPathRef(
    pathId: ElementId,
    countOnly?: boolean
  ): Promise<number | Effect[]> {
    try {
      return countOnly
        ? await this.effects.where({ pathId }).count()
        : await this.effects.where({ pathId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getEffectsByVariableRef(
    variableId: ElementId
  ): Promise<Effect[]> {
    try {
      return await this.effects.where({ variableId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveEffect(effect: Effect): Promise<ElementId> {
    if (!effect.pathId)
      throw new Error('Unable to save effect to database. Missing path ID.')
    if (!effect.id)
      throw new Error('Unable to save effect to database. Missing ID.')

    try {
      await this.transaction('rw', this.effects, async () => {
        if (effect.id) {
          if (await this.getElement(LIBRARY_TABLE.EFFECTS, effect.id)) {
            await this.effects.update(effect.id, {
              ...effect,
              updated: Date.now()
            })
          } else {
            await this.effects.add({
              ...effect,
              updated: effect.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save effect to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return effect.id
  }

  public async saveEffectSetOperatorType(
    effectId: ElementId,
    newSetOperatorType: SET_OPERATOR_TYPE
  ) {
    try {
      await this.transaction('rw', this.effects, async () => {
        if (effectId) {
          const effect = await this.effects.where({ id: effectId }).first()

          if (effect) {
            await this.effects.update(effectId, {
              ...effect,
              set: [
                effect.set[0],
                newSetOperatorType,
                effect.set[2],
                effect.set[3]
              ],
              updated: Date.now()
            })
          } else {
            throw new Error(
              'Unable to set effect set operator type. Component missing.'
            )
          }
        } else {
          throw new Error('Unable to set effect set operator type. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveEffectValue(effectId: ElementId, newValue: string) {
    try {
      await this.transaction('rw', this.effects, async () => {
        if (effectId) {
          const effect = await this.effects.where({ id: effectId }).first()

          if (effect) {
            await this.effects.update(effectId, {
              ...effect,
              set: [effect.set[0], effect.set[1], newValue, effect.set[3]],
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to set effect value. Component missing.')
          }
        } else {
          throw new Error('Unable to set effect value. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removeEffect(effectId: ElementId) {
    logger.info(`LibraryDatabase->removeEffect`)

    try {
      await this.transaction('rw', this.effects, async () => {
        if (await this.getElement(LIBRARY_TABLE.EFFECTS, effectId)) {
          logger.info(
            `LibraryDatabase->removeEffect->Removing effect with ID: ${effectId}`
          )

          await this.effects.delete(effectId)
        } else {
          // TODO: #70; async issue - we can do things in order, but this is likely more efficient
          logger.error(
            `LibraryDatabase->removeEffect->Unable to remove effect with ID: '${effectId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getEvent(eventId: ElementId): Promise<Event | undefined> {
    try {
      const event = await this.events.get(eventId)

      if (event) {
        return event
      } else {
        logger.error(`Unable to get event with ID: ${eventId}. Does not exist.`)

        return undefined
      }
    } catch (error) {
      // Unlike its siblings this method logs and swallows rather than
      // rethrowing, so the absent event is reported the same way as a missing
      // one. Returning explicitly is what the declared type already promised.
      logger.error(`Unable to get event with ID: ${eventId}. ${error}.`)

      return undefined
    }
  }

  public async saveEvent(event: Event): Promise<Event> {
    if (!event.sceneId)
      throw new Error('Unable to save event to database. Missing scene ID.')
    if (!event.id)
      throw new Error('Unable to save event to database. Missing ID.')

    try {
      await this.transaction('rw', this.events, async () => {
        if (event.id) {
          if (await this.getElement(LIBRARY_TABLE.EVENTS, event.id)) {
            await this.events.update(event.id, {
              ...event,
              updated: Date.now()
            })
          } else {
            await this.events.add({
              ...event,
              updated: event.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save event to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return event
  }

  public async saveEventType(eventId: ElementId, type: EVENT_TYPE) {
    try {
      await this.transaction('rw', this.events, async () => {
        if (eventId) {
          const event = await this.getElement(LIBRARY_TABLE.EVENTS, eventId)

          if (event) {
            await this.events.update(eventId, {
              ...event,
              type,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save type to event. Event missing.')
          }
        } else {
          throw new Error('Unable to save type to event. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveEventInput(eventId: ElementId, inputId?: ElementId) {
    try {
      await this.transaction('rw', this.events, async () => {
        if (eventId) {
          const event = await this.getElement(LIBRARY_TABLE.EVENTS, eventId)

          if (event) {
            await this.events.update(eventId, {
              ...event,
              input: inputId,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save input to event. Event missing.')
          }
        } else {
          throw new Error('Unable to save input to event. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveEventContent(eventId: ElementId, content: string) {
    try {
      await this.transaction('rw', this.events, async () => {
        if (eventId) {
          const event = await this.getElement(LIBRARY_TABLE.EVENTS, eventId)

          if (event) {
            await this.events.update(eventId, {
              ...event,
              content,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save content to event. Event missing.')
          }
        } else {
          throw new Error('Unable to save content to event. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveSceneRefToEvent(sceneId: ElementId, eventId: ElementId) {
    logger.info(
      `LibraryDatabase->saveSceneRefToEvent->scene: ${sceneId}->event: ${eventId}`
    )

    try {
      const event = await this.getElement(LIBRARY_TABLE.EVENTS, eventId)

      if (event && event.id) {
        await this.events.update(event.id, {
          ...event,
          sceneId,
          updated: Date.now()
        })
      } else {
        throw new Error('Unable to save scene ID. Missing event.')
      }
    } catch (error) {
      throw error
    }
  }

  public async saveChoiceRefsToEvent(eventId: ElementId, choices: ElementId[]) {
    try {
      await this.transaction('rw', this.events, async () => {
        if (eventId) {
          const event = await this.getElement(LIBRARY_TABLE.EVENTS, eventId)

          if (event) {
            this.events.update(eventId, {
              ...event,
              choices,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save choice refs. Event missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async setEventEnding(eventId: ElementId, ending: boolean) {
    try {
      await this.transaction('rw', this.events, async () => {
        if (eventId) {
          const event = await this.getElement(LIBRARY_TABLE.EVENTS, eventId)

          if (event) {
            this.events.update(eventId, {
              ...event,
              ending,
              updated: Date.now()
            })
          } else {
            throw new Error('Unable to save event ending. Event missing.')
          }
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async removeEvent(
    eventId: ElementId,
    skipOriginPaths: boolean = false,
    skipDestinationPaths: boolean = false,
    /*
     * Set when something outside the database still references the event's
     * assets — a scene map cut, whose clipboard holds the event until it is
     * pasted. Trashing them here would hand back an event whose image and audio
     * files are in userData/.trash. An unpasted cut therefore leaves the assets
     * behind, which the asset manager is there to find.
     */
    keepAssets: boolean = false
  ) {
    try {
      logger.info('LibraryDatabase->removeEvent')

      const event: Event | undefined = await this.events.get(eventId)

      if (event?.sceneId) {
        const updatedSceneChildRefs: SceneChildRefs =
            (await this.scenes.get(event.sceneId))?.children || [],
          foundEventIndex = updatedSceneChildRefs.findIndex(
            (childRef) => childRef[1] === event.id
          )

        if (updatedSceneChildRefs && foundEventIndex !== -1) {
          updatedSceneChildRefs.splice(foundEventIndex, 1)

          await this.saveChildRefsToScene(event.sceneId, updatedSceneChildRefs)
        }
      }

      // scene map copy and paste lets two events name one mp3, so the file is
      // only trashed once nothing else in the storyworld references it. This used
      // to remove the asset unconditionally, which took the track from under the
      // other event.
      !keepAssets &&
        event?.audio?.[0] &&
        event.id &&
        (await api().events.removeDeadAudioAsset(
          this.studioId,
          event.worldId,
          event.audio[0],
          [event.id]
        ))

      if (!keepAssets && event?.id && event.images.length > 0) {
        await api().events.removeDeadImageAssets(
          this.studioId,
          event.worldId,
          event.images,
          [event.id]
        )
      }

      await this.transaction('rw', this.events, async () => {
        if (await this.getElement(LIBRARY_TABLE.EVENTS, eventId)) {
          logger.info(
            `LibraryDatabase->removeEvent->Removing event with ID: ${eventId}`
          )

          await this.events.delete(eventId)
        } else {
          logger.error(
            `LibraryDatabase->removeEvent->Unable to remove event with ID: '${eventId}'. Does not exist.`
          )
        }
      })

      const jumps = await this.jumps.where({ path: eventId }).toArray(),
        pathsWithOrigin = await this.paths
          .where({ originId: eventId })
          .toArray(),
        pathsWithDestination = await this.paths
          .where({ destinationId: eventId })
          .toArray(),
        choices = await this.choices.where({ eventId }).toArray(),
        inputs = await this.inputs.where({ eventId }).toArray()

      const removeEventPromises = [
        jumps.map(
          async (jump) =>
            jump.id && (await this.saveJumpPath(jump.id, [jump.path[0]]))
        ),
        choices.map(
          async (choice) => choice.id && (await this.removeChoice(choice.id))
        ),
        inputs.map(
          async (input) => input.id && (await this.removeInput(input.id))
        )
      ]

      jumps.length > 0 &&
        logger.info(
          `LibraryDatabase->removeEvent->Updating ${jumps.length} jump(s) from event with ID: ${eventId}`
        )

      if (!skipOriginPaths && pathsWithOrigin.length > 0) {
        logger.info(
          `LibraryDatabase->removeEvent->Removing ${pathsWithDestination.length} path(s) with origin from event with ID: ${eventId}`
        )

        removeEventPromises.push(
          pathsWithOrigin.map(
            async (path) => path.id && (await this.removePath(path.id))
          )
        )
      }

      if (!skipDestinationPaths && pathsWithDestination.length > 0) {
        logger.info(
          `LibraryDatabase->removeEvent->Removing ${pathsWithDestination.length} path(s) with destination from event with ID: ${eventId}`
        )

        removeEventPromises.push(
          pathsWithDestination.map(
            async (path) => path.id && (await this.removePath(path.id))
          )
        )
      }

      choices.length > 0 &&
        logger.info(
          `LibraryDatabase->removeEvent->Removing ${choices.length} choice(s) from event with ID: ${eventId}`
        )

      inputs.length > 0 &&
        logger.info(
          `LibraryDatabase->removeEvent->Removing ${inputs.length} input(s) from event with ID: ${eventId}`
        )

      await Promise.all(removeEventPromises)
    } catch (error) {
      throw error
    }
  }

  public async getEventsByWorldRef(worldId: WorldId): Promise<Event[]> {
    try {
      return await this.events.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getChoice(choiceId: ElementId): Promise<Choice> {
    logger.info(`LibraryDatabase->getChoice`)

    try {
      const choice = await this.choices.get(choiceId)

      if (choice) {
        return choice
      } else {
        throw new Error(
          `LibraryDatabase->getChoice->Unable to get choice with ID: ${choiceId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getChoicesByWorldRef(worldId: WorldId): Promise<Choice[]> {
    try {
      return await this.choices.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveChoice(choice: Choice): Promise<Choice> {
    if (!choice.worldId)
      throw new Error('Unable to save choice to database. Missing game ID.')
    if (!choice.eventId)
      throw new Error('Unable to save choice to database. Missing event ID.')
    if (!choice.id)
      throw new Error('Unable to save choice to database. Missing ID.')

    try {
      await this.transaction('rw', this.choices, async () => {
        if (choice.id) {
          if (await this.getElement(LIBRARY_TABLE.CHOICES, choice.id)) {
            await this.choices.update(choice.id, {
              ...choice,
              updated: Date.now()
            })
          } else {
            await this.choices.add({
              ...choice,
              updated: choice.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save choice to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return choice
  }

  public async removeChoice(choiceId: ElementId) {
    try {
      const routes = await this.paths.where({ choiceId }).toArray()

      if (routes.length > 0) {
        logger.info(
          `removeChoice->Removing ${routes.length} path(s) from choice with ID: ${choiceId}`
        )
      }

      await Promise.all(
        routes.map(async (path) => path.id && (await this.removePath(path.id)))
      )

      await this.transaction('rw', this.choices, async () => {
        if (await this.getElement(LIBRARY_TABLE.CHOICES, choiceId)) {
          logger.info(`removeChoice->Removing choice with ID: ${choiceId}`)

          await this.choices.delete(choiceId)
        } else {
          // elmstorygames/feedback#240
          logger.error(
            `removeChoice->Unable to remove choice with ID: '${choiceId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getInput(inputId: ElementId): Promise<Input> {
    logger.info(`LibraryDatabase->getInput`)

    try {
      const input = await this.inputs.get(inputId)

      if (input) {
        return input
      } else {
        throw new Error(
          `LibraryDatabase->getInput->Unable to get input with ID: ${inputId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getInputsByWorldRef(worldId: WorldId): Promise<Input[]> {
    try {
      return await this.inputs.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveInput(input: Input): Promise<Input> {
    if (!input.worldId)
      throw new Error('Unable to save input to database. Missing game ID.')
    if (!input.eventId)
      throw new Error('Unable to save input to database. Missing event ID.')
    if (!input.id)
      throw new Error('Unable to save input to database. Missing ID.')

    try {
      await this.transaction('rw', this.inputs, async () => {
        if (input.id) {
          if (await this.getElement(LIBRARY_TABLE.INPUTS, input.id)) {
            await this.inputs.update(input.id, {
              ...input,
              updated: Date.now()
            })
          } else {
            await this.inputs.add({
              ...input,
              updated: input.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save input to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return input
  }

  public async saveVariableRefToInput(
    inputId: ElementId,
    variableId?: ElementId
  ) {
    logger.info(
      `LibraryDatabase->saveVariableRefToInput->input: ${inputId}->variable: ${variableId}`
    )

    try {
      const input = await this.getElement(LIBRARY_TABLE.INPUTS, inputId)

      if (input?.id) {
        await this.inputs.update(input.id, {
          ...input,
          variableId,
          updated: Date.now()
        })
      } else {
        throw new Error('Unable to save variable ID. Missing input.')
      }
    } catch (error) {
      throw error
    }
  }

  public async removeInput(inputId: ElementId) {
    try {
      const paths = await this.paths.where({ inputId }).toArray()

      if (paths.length > 0) {
        logger.info(
          `removeInput->Removing ${paths.length} path(s) from input with ID: ${inputId}`
        )
      }

      await Promise.all(
        paths.map(async (path) => path.id && (await this.removePath(path.id)))
      )

      await this.transaction('rw', this.inputs, async () => {
        if (await this.getElement(LIBRARY_TABLE.INPUTS, inputId)) {
          logger.info(`removeInput->Removing input with ID: ${inputId}`)

          await this.inputs.delete(inputId)
        } else {
          // elmstorygames/feedback#240
          logger.error(
            `removeInput->Unable to remove input with ID: '${inputId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async getVariable(variableId: ElementId): Promise<Variable> {
    try {
      const variable = await this.variables.get(variableId)

      if (variable) {
        return variable
      } else {
        throw new Error(
          `Unable to get variable with ID: ${variableId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getVariablesByWorldRef(worldId: WorldId): Promise<Variable[]> {
    try {
      return await this.variables.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveVariable(variable: Variable): Promise<ElementId> {
    if (!variable.worldId)
      throw new Error('Unable to save variable to database. Missing world ID.')
    if (!variable.id)
      throw new Error('Unable to save variable to database. Missing ID.')

    try {
      await this.transaction('rw', this.variables, async () => {
        if (variable.id) {
          if (await this.getElement(LIBRARY_TABLE.VARIABLES, variable.id)) {
            await this.variables.update(variable.id, {
              ...variable,
              updated: Date.now()
            })
          } else {
            await this.variables.add({
              ...variable,
              updated: variable.updated || Date.now()
            })
          }
        } else {
          throw new Error('Unable to save variable to database. Missing ID.')
        }
      })
    } catch (error) {
      throw error
    }

    return variable.id
  }

  public async removeVariable(variableId: ElementId) {
    logger.info(`LibraryDatabase->removeVariable:${variableId}`)

    try {
      const conditions = await this.conditions.where({ variableId }).toArray(),
        effects = await this.effects.where({ variableId }).toArray(),
        inputs = await this.inputs.where({ variableId }).toArray()

      await Promise.all([
        conditions.map(
          async (condition) =>
            condition.id && (await this.removeCondition(condition.id))
        ),
        effects.map(
          async (effect) => effect.id && (await this.removeEffect(effect.id))
        ),
        inputs.map(
          async (input) =>
            input.id && (await this.saveVariableRefToInput(input.id, undefined))
        )
      ])

      /*
       * 0.8.0 added three more places a variable is named, and all three are
       * invisible to the reader above: two are inline arrays rather than rows with
       * a `variableId` index, so nothing would report them as broken. A recipe
       * effect or a placement gate naming a deleted variable would be evaluated
       * against a variable that is not in the live event state at all.
       */
      const variable = await this.variables.get(variableId)

      if (variable) {
        const { worldId } = variable

        const [recipes, objects, relationships] = await Promise.all([
          this.recipes.where({ worldId }).toArray(),
          this.objects.where({ worldId }).toArray(),
          this.characterRelationships.where({ worldId }).toArray()
        ])

        for (const recipe of recipes) {
          if (!recipe.id) continue

          const remaining = recipe.effects?.filter(
            (effect) => effect[0] !== variableId
          )

          if ((remaining?.length ?? 0) !== (recipe.effects?.length ?? 0))
            await this.saveRecipe({ ...recipe, effects: remaining })
        }

        for (const object of objects) {
          if (!object.id) continue

          const placements = object.placements.map((placement) => ({
            ...placement,
            variableConditions: placement.variableConditions?.filter(
              (condition) => condition[0] !== variableId
            )
          }))

          const changed = placements.some(
            (placement, index) =>
              (placement.variableConditions?.length ?? 0) !==
              (object.placements[index].variableConditions?.length ?? 0)
          )

          if (changed) await this.saveObject({ ...object, placements })
        }

        for (const relationship of relationships) {
          if (relationship.id && relationship.variableId === variableId)
            await this.saveCharacterRelationship({
              ...relationship,
              variableId: undefined
            })
        }
      }

      await this.transaction('rw', this.variables, async () => {
        if (await this.getElement(LIBRARY_TABLE.VARIABLES, variableId)) {
          logger.info(
            `LibraryDatabase->removeVariable->Removing variable with ID: ${variableId}`
          )

          await this.variables.delete(variableId)
        } else {
          throw new Error(
            `LibraryDatabase->removeVariable->Unable to remove variable with ID: '${variableId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  public async saveVariableType(variableId: ElementId, type: VARIABLE_TYPE) {
    await this.transaction('rw', this.variables, async () => {
      if (variableId) {
        const component = await this.getElement(
          LIBRARY_TABLE.VARIABLES,
          variableId
        )

        if (component) {
          await this.variables.update(variableId, {
            ...component,
            type,
            initialValue:
              type === VARIABLE_TYPE.BOOLEAN
                ? 'false'
                : type === VARIABLE_TYPE.NUMBER
                ? '0'
                : '',
            updated: Date.now()
          })
        } else {
          throw new Error('Unable to save variable type. Variable missing.')
        }
      } else {
        throw new Error('Unable to save variable type. Missing ID.')
      }
    })
  }

  /**
   * How long a variable keeps its value.
   *
   * `scopeId` is cleared for a WORLD-scoped variable rather than left behind: a
   * stale scene would resurrect the old scope the moment SCENE was chosen again,
   * and `resetSceneScopedVariables` matches on `scopeId`, so a leftover one is a
   * reset waiting to fire in a scene the author has stopped thinking about.
   *
   * Both fields are optional and unindexed, so this needed no migration — and
   * absent `scope` means WORLD, which is what every variable written before 0.8.0
   * has.
   */
  public async saveVariableScope(
    variableId: ElementId,
    scope: VARIABLE_SCOPE,
    scopeId: ElementId | undefined
  ) {
    await this.transaction('rw', this.variables, async () => {
      if (variableId) {
        const component = await this.getElement(
          LIBRARY_TABLE.VARIABLES,
          variableId
        )

        if (component) {
          await this.variables.update(variableId, {
            ...component,
            scope,
            scopeId: scope === VARIABLE_SCOPE.SCENE ? scopeId : undefined,
            updated: Date.now()
          })
        } else {
          throw new Error(
            'Unable to save variable scope. Variable missing.'
          )
        }
      } else {
        throw new Error('Unable to save variable scope. Missing variable ID.')
      }
    })
  }

  public async saveVariableDescription(
    variableId: ElementId,
    description: string | undefined
  ) {
    await this.transaction('rw', this.variables, async () => {
      if (variableId) {
        const component = await this.getElement(
          LIBRARY_TABLE.VARIABLES,
          variableId
        )

        if (component) {
          await this.variables.update(variableId, {
            ...component,
            // an emptied field is dropped rather than stored as '', so a
            // variable that never had one and one that was cleared look alike
            description: description || undefined,
            updated: Date.now()
          })
        } else {
          throw new Error(
            'Unable to save variable description. Variable missing.'
          )
        }
      } else {
        throw new Error('Unable to save variable description. Missing ID.')
      }
    })
  }

  public async saveVariableInitialValue(
    variableId: ElementId,
    initialValue: string
  ) {
    await this.transaction('rw', this.variables, async () => {
      if (variableId) {
        const component = await this.getElement(
          LIBRARY_TABLE.VARIABLES,
          variableId
        )

        if (component) {
          await this.variables.update(variableId, {
            ...component,
            initialValue,
            updated: Date.now()
          })
        } else {
          throw new Error(
            'Unable to save variable initialValue. Variable missing.'
          )
        }
      } else {
        throw new Error('Unable to save variable initialValue. Missing ID.')
      }
    })
  }

  // WORLD OBJECTS

  public async getObject(objectId: ElementId): Promise<WorldObject> {
    try {
      const object = await this.objects.get(objectId)

      if (object) {
        return object
      } else {
        throw new Error(
          `Unable to get object with ID: ${objectId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getObjectsByWorldRef(worldId: WorldId): Promise<WorldObject[]> {
    try {
      return await this.objects.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveObject(object: WorldObject): Promise<ElementId> {
    if (!object.worldId)
      throw new Error('Unable to save object to database. Missing world ID.')
    if (!object.id)
      throw new Error('Unable to save object to database. Missing ID.')

    try {
      await this.transaction('rw', this.objects, async () => {
        if (await this.getElement(LIBRARY_TABLE.OBJECTS, object.id as string)) {
          await this.objects.update(object.id as string, {
            ...object,
            updated: Date.now()
          })
        } else {
          await this.objects.add({
            ...object,
            updated: object.updated || Date.now()
          })
        }
      })
    } catch (error) {
      throw error
    }

    return object.id
  }

  /**
   * Removes an object and everything that names it.
   *
   * The cascade is wide on purpose, and it is why the editor has to state the
   * consequences before it runs — the same reasoning as `confirmRemoveVariable`.
   * A recipe naming a deleted object could never fire again, and an object
   * condition naming one would gate a path on something that cannot exist, so
   * both are removed rather than left dangling. Placements on *other* objects
   * that gate on this one are cleaned too, which is the non-obvious half: a gate
   * is an inline array, so nothing would report it as broken.
   *
   * `Promise.all` is deliberately not used for the placement rewrites. Each is a
   * read-modify-write of one object's own `placements` array, and two rewrites of
   * *different* objects are independent — but the loop is cheap and sequential
   * writes here keep the shape identical to the scene-children rule, where a
   * parallel version silently lost updates.
   */
  public async removeObject(objectId: ElementId) {
    logger.info(`LibraryDatabase->removeObject:${objectId}`)

    try {
      const object = await this.objects.get(objectId)

      if (!object)
        throw new Error(
          `LibraryDatabase->removeObject->Unable to remove object with ID: '${objectId}'. Does not exist.`
        )

      const { worldId } = object

      const [recipes, objectConditions, allObjects] = await Promise.all([
        this.recipes.where({ worldId }).toArray(),
        this.objectConditions.where({ objectId }).toArray(),
        this.objects.where({ worldId }).toArray()
      ])

      const deadRecipes = recipes.filter(
        (recipe) =>
          recipe.inputs.some((input) => input.objectId === objectId) ||
          recipe.outputs.some((output) => output.objectId === objectId)
      )

      for (const recipe of deadRecipes) {
        recipe.id && (await this.removeRecipe(recipe.id))
      }

      for (const condition of objectConditions) {
        condition.id && (await this.removeObjectCondition(condition.id))
      }

      // placement gates on other objects that reference this one
      for (const other of allObjects) {
        if (!other.id || other.id === objectId) continue

        const placements = other.placements.map((placement) => ({
          ...placement,
          objectConditions: placement.objectConditions?.filter(
            (condition) => condition.objectId !== objectId
          )
        }))

        const changed = placements.some(
          (placement, index) =>
            (placement.objectConditions?.length ?? 0) !==
            (other.placements[index].objectConditions?.length ?? 0)
        )

        if (changed) await this.saveObject({ ...other, placements })
      }

      const deadAsset = object.assetId,
        deadStackedAsset = object.stackedAssetId

      await this.transaction('rw', this.objects, async () => {
        await this.objects.delete(objectId)
      })

      // sequentially, so each count sees what the one before it trashed, and
      // after the reference is gone — the count is read back out of the database
      for (const assetId of [deadAsset, deadStackedAsset]) {
        if (!assetId) continue

        await api().assets.removeAssetIfUnreferenced(
          this.studioId,
          worldId,
          assetId,
          ASSET_KINDS[ASSET_KIND.OBJECT_IMAGE].ext
        )
      }
    } catch (error) {
      throw error
    }
  }

  // RECIPES

  public async getRecipe(recipeId: ElementId): Promise<Recipe> {
    try {
      const recipe = await this.recipes.get(recipeId)

      if (recipe) {
        return recipe
      } else {
        throw new Error(
          `Unable to get recipe with ID: ${recipeId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getRecipesByWorldRef(worldId: WorldId): Promise<Recipe[]> {
    try {
      return await this.recipes.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveRecipe(recipe: Recipe): Promise<ElementId> {
    if (!recipe.worldId)
      throw new Error('Unable to save recipe to database. Missing world ID.')
    if (!recipe.id)
      throw new Error('Unable to save recipe to database. Missing ID.')

    try {
      await this.transaction('rw', this.recipes, async () => {
        if (await this.getElement(LIBRARY_TABLE.RECIPES, recipe.id as string)) {
          await this.recipes.update(recipe.id as string, {
            ...recipe,
            updated: Date.now()
          })
        } else {
          await this.recipes.add({
            ...recipe,
            updated: recipe.updated || Date.now()
          })
        }
      })
    } catch (error) {
      throw error
    }

    return recipe.id
  }

  public async removeRecipe(recipeId: ElementId) {
    logger.info(`LibraryDatabase->removeRecipe:${recipeId}`)

    try {
      await this.transaction('rw', this.recipes, async () => {
        if (await this.getElement(LIBRARY_TABLE.RECIPES, recipeId)) {
          await this.recipes.delete(recipeId)
        } else {
          throw new Error(
            `LibraryDatabase->removeRecipe->Unable to remove recipe with ID: '${recipeId}'. Does not exist.`
          )
        }
      })
    } catch (error) {
      throw error
    }
  }

  // OBJECT CONDITIONS

  public async getObjectCondition(
    conditionId: ElementId
  ): Promise<ObjectCondition> {
    try {
      const condition = await this.objectConditions.get(conditionId)

      if (condition) {
        return condition
      } else {
        throw new Error(
          `Unable to get object condition with ID: ${conditionId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getObjectConditionsByWorldRef(
    worldId: WorldId
  ): Promise<ObjectCondition[]> {
    try {
      return await this.objectConditions.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async getObjectConditionsByPathRef(
    pathId: ElementId
  ): Promise<ObjectCondition[]> {
    try {
      return await this.objectConditions.where({ pathId }).toArray()
    } catch (error) {
      throw error
    }
  }

  public async saveObjectCondition(
    condition: ObjectCondition
  ): Promise<ElementId> {
    if (!condition.worldId)
      throw new Error(
        'Unable to save object condition to database. Missing world ID.'
      )
    if (!condition.id)
      throw new Error('Unable to save object condition to database. Missing ID.')

    try {
      await this.transaction('rw', this.objectConditions, async () => {
        if (
          await this.getElement(
            LIBRARY_TABLE.OBJECT_CONDITIONS,
            condition.id as string
          )
        ) {
          await this.objectConditions.update(condition.id as string, {
            ...condition,
            updated: Date.now()
          })
        } else {
          await this.objectConditions.add({
            ...condition,
            updated: condition.updated || Date.now()
          })
        }
      })
    } catch (error) {
      throw error
    }

    return condition.id
  }

  public async removeObjectCondition(conditionId: ElementId) {
    logger.info(`LibraryDatabase->removeObjectCondition:${conditionId}`)

    try {
      await this.transaction('rw', this.objectConditions, async () => {
        if (await this.getElement(LIBRARY_TABLE.OBJECT_CONDITIONS, conditionId))
          await this.objectConditions.delete(conditionId)
      })
    } catch (error) {
      throw error
    }
  }

  // CHARACTER RELATIONSHIPS

  public async getCharacterRelationship(
    relationshipId: ElementId
  ): Promise<CharacterRelationship> {
    try {
      const relationship = await this.characterRelationships.get(relationshipId)

      if (relationship) {
        return relationship
      } else {
        throw new Error(
          `Unable to get character relationship with ID: ${relationshipId}. Does not exist.`
        )
      }
    } catch (error) {
      throw error
    }
  }

  public async getCharacterRelationshipsByWorldRef(
    worldId: WorldId
  ): Promise<CharacterRelationship[]> {
    try {
      return await this.characterRelationships.where({ worldId }).toArray()
    } catch (error) {
      throw error
    }
  }

  /** Both directions, since an undirected relationship is stored one way only. */
  public async getCharacterRelationshipsByCharacterRef(
    characterId: ElementId
  ): Promise<CharacterRelationship[]> {
    try {
      const [from, to] = await Promise.all([
        this.characterRelationships.where({ from: characterId }).toArray(),
        this.characterRelationships.where({ to: characterId }).toArray()
      ])

      return [...from, ...to.filter((relationship) => relationship.from !== characterId)]
    } catch (error) {
      throw error
    }
  }

  public async saveCharacterRelationship(
    relationship: CharacterRelationship
  ): Promise<ElementId> {
    if (!relationship.worldId)
      throw new Error(
        'Unable to save character relationship to database. Missing world ID.'
      )
    if (!relationship.id)
      throw new Error(
        'Unable to save character relationship to database. Missing ID.'
      )

    try {
      await this.transaction('rw', this.characterRelationships, async () => {
        if (
          await this.getElement(
            LIBRARY_TABLE.CHARACTER_RELATIONSHIPS,
            relationship.id as string
          )
        ) {
          await this.characterRelationships.update(relationship.id as string, {
            ...relationship,
            updated: Date.now()
          })
        } else {
          await this.characterRelationships.add({
            ...relationship,
            updated: relationship.updated || Date.now()
          })
        }
      })
    } catch (error) {
      throw error
    }

    return relationship.id
  }

  public async removeCharacterRelationship(relationshipId: ElementId) {
    logger.info(
      `LibraryDatabase->removeCharacterRelationship:${relationshipId}`
    )

    try {
      await this.transaction('rw', this.characterRelationships, async () => {
        if (
          await this.getElement(
            LIBRARY_TABLE.CHARACTER_RELATIONSHIPS,
            relationshipId
          )
        )
          await this.characterRelationships.delete(relationshipId)
      })
    } catch (error) {
      throw error
    }
  }
}

/**
 * One database instance per database, because a Dexie instance *is* a
 * connection.
 *
 * Every call site used to write `new LibraryDatabase(studioId)` — 242 of them
 * in this project and 77 in the engine — and each call opened another
 * IndexedDB connection, pushed itself onto Dexie's module-global
 * `connections` array (which only `close()` pops), registered its own window
 * listeners and, through the live queries created from it, retained the React
 * tree that had built it. Nothing ever released one, so the count only went
 * up, every write fanned out to all of them, and unmounted components stayed
 * in memory with their DOM.
 *
 * Measured in the running app before this: 130 connections just from opening a
 * storyworld, ~50 more per variable edit, ~100 per choice taken in the
 * preview, 1315 after fifteen minutes of ordinary authoring — with the heap at
 * 442MB and an outline click that costs 50ms on a fresh window costing 459ms.
 * Closing every editor tab released none of it.
 *
 * Reuse is safe because a `Dexie` instance is not per-transaction state: it is
 * the schema and the connection, and Dexie serialises transactions on it.
 */
const libraryDatabases = new Map<StudioId, LibraryDatabase>()

export const getLibraryDatabase = (studioId: StudioId): LibraryDatabase => {
  const existing = libraryDatabases.get(studioId)

  if (existing) return existing

  const database = new LibraryDatabase(studioId)

  libraryDatabases.set(studioId, database)

  return database
}

/**
 * Drops a studio's cached instance. Only deleting the database needs this —
 * the instance is left holding a database that no longer exists, and the next
 * caller should build a fresh one.
 */
export const forgetLibraryDatabase = (studioId: StudioId) =>
  libraryDatabases.delete(studioId)

let appDatabase: AppDatabase | undefined

export const getAppDatabase = (): AppDatabase =>
  (appDatabase = appDatabase || new AppDatabase())
