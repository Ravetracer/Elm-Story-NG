import {
  Character,
  CHARACTER_MASK_TYPE,
  ElementId,
  Event,
  Scene
} from '../data/types'

/**
 * Assets are stored flat as `<id>.<ext>` under
 * `userData/assets/<studioId>/<worldId>`, so the extension is the only record of
 * what an asset is for. The writers pick it: character masks are saved as jpeg
 * (CharacterPersonality), event content images as webp (EventContent) and both
 * scene and event audio as mp3 (ElementAudio).
 *
 * Those three are the only extensions a storyworld can reference, but not the
 * only ones that turn up in the directory: IMPORT_WORLD_ASSETS copies whatever
 * sits beside an imported JSON, so a real imported world here also carries a
 * .png. Listing only what the app writes hides exactly the files most likely to
 * be dead weight, so the manager lists everything and infers what it can.
 */
export type REFERENCED_EXTENSION = 'jpeg' | 'webp' | 'mp3'

/** One file found on disk. Returned by the LIST_ASSETS IPC handler. */
export interface AssetFile {
  id: string // basename without the extension
  ext: string // extension without the dot, '' for a file that has none
  bytes: number
  modified: number // epoch ms
}

export enum ASSET_MEDIA {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  OTHER = 'OTHER'
}

const IMAGE_EXTENSIONS = [
  'apng',
  'avif',
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp'
]

const AUDIO_EXTENSIONS = ['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'wav']

export const assetMedia = ({ ext }: { ext: string }): ASSET_MEDIA => {
  if (IMAGE_EXTENSIONS.includes(ext)) return ASSET_MEDIA.IMAGE
  if (AUDIO_EXTENSIONS.includes(ext)) return ASSET_MEDIA.AUDIO

  return ASSET_MEDIA.OTHER
}

export enum ASSET_REFERENCE_TYPE {
  CHARACTER_MASK = 'CHARACTER_MASK',
  EVENT_IMAGE = 'EVENT_IMAGE',
  EVENT_AUDIO = 'EVENT_AUDIO',
  SCENE_AUDIO = 'SCENE_AUDIO'
}

/** Where a storyworld points at an asset. */
export interface AssetReference {
  type: ASSET_REFERENCE_TYPE
  elementId: ElementId
  elementTitle: string
  // the mask type, for a character reference
  detail?: CHARACTER_MASK_TYPE
}

export interface ManagedAsset extends AssetFile {
  references: AssetReference[]
  // referenced by the storyworld but absent from disk
  missing: boolean
}

/**
 * An event content image lives in two places: the id is in `Event.images` and
 * the Slate document carries a matching IMG node. Dropping only the array entry
 * would leave the document rendering an asset that is gone, and rewriting the
 * document from here would be overwritten by an open content editor's next
 * debounced save. So the manager clears the references it can set to a single
 * value and refuses the rest.
 */
export const isReferenceClearable = (type: ASSET_REFERENCE_TYPE): boolean =>
  type !== ASSET_REFERENCE_TYPE.EVENT_IMAGE

/**
 * What an image slot does to a file on the way in.
 *
 * Every asset is processed to fixed dimensions and a fixed format, which is what
 * makes a stored asset interchangeable with a freshly imported one — the whole
 * premise of assigning an existing asset rather than importing a new file. The
 * numbers were the two crop call sites' own literals; they live here so the asset
 * manager can produce an asset that is indistinguishable from one imported in
 * place, rather than a second, near-miss variety.
 */
export interface ImageAssetPipeline {
  aspectRatio: number
  size: { width: number; height: number }
  format: Extract<REFERENCED_EXTENSION, 'jpeg' | 'webp'>
  quality: number
}

export const CHARACTER_MASK_PIPELINE: ImageAssetPipeline = {
  aspectRatio: 4 / 5,
  size: { width: 200, height: 250 },
  format: 'jpeg',
  quality: 1
}

export const EVENT_IMAGE_PIPELINE: ImageAssetPipeline = {
  aspectRatio: 16 / 9,
  // the composer's writing column is 655px wide; twice that is the retina size
  size: { width: 655 * 2, height: 368 * 2 },
  format: 'webp',
  quality: 0.7
}

/**
 * What an asset *is*, as opposed to where it is referenced from.
 *
 * The distinction only appears once an asset can be uploaded before it is
 * assigned: `ASSET_REFERENCE_TYPE` answers "who points at this file", which an
 * unassigned asset has no answer to, while a kind answers "what was this
 * processed as", which is fixed the moment it is written to disk. Event audio
 * and scene audio are two reference types and one kind.
 */
export enum ASSET_KIND {
  CHARACTER_MASK = 'CHARACTER_MASK',
  EVENT_IMAGE = 'EVENT_IMAGE',
  AUDIO = 'AUDIO'
}

export interface AssetKindProfile {
  label: string
  /**
   * What a file of this kind is stored as. Assets are stored flat as
   * `<id>.<ext>` and every read site asks for the extension it expects rather
   * than looking at disk, so this is also what a picker has to filter on: a
   * `.png` assigned to a mask would be requested as `.jpeg`, come back missing,
   * and CharacterMask would then silently clear the assignment.
   */
  ext: REFERENCED_EXTENSION
  /** the file input's accept attribute */
  accept: string
  /** absent for audio, which is stored exactly as imported */
  pipeline?: ImageAssetPipeline
}

export const ASSET_KINDS: Record<ASSET_KIND, AssetKindProfile> = {
  [ASSET_KIND.EVENT_IMAGE]: {
    label: 'Event Image',
    ext: 'webp',
    accept: 'image/*',
    pipeline: EVENT_IMAGE_PIPELINE
  },
  [ASSET_KIND.CHARACTER_MASK]: {
    label: 'Character Mask',
    ext: 'jpeg',
    accept: 'image/*',
    pipeline: CHARACTER_MASK_PIPELINE
  },
  [ASSET_KIND.AUDIO]: {
    label: 'Audio',
    ext: 'mp3',
    accept: 'audio/mp3'
  }
}

export const assetKindForReference = (
  type: ASSET_REFERENCE_TYPE
): ASSET_KIND => {
  switch (type) {
    case ASSET_REFERENCE_TYPE.CHARACTER_MASK:
      return ASSET_KIND.CHARACTER_MASK
    case ASSET_REFERENCE_TYPE.EVENT_IMAGE:
      return ASSET_KIND.EVENT_IMAGE
    case ASSET_REFERENCE_TYPE.EVENT_AUDIO:
    case ASSET_REFERENCE_TYPE.SCENE_AUDIO:
      return ASSET_KIND.AUDIO
  }
}

export const extensionForReference = (
  type: ASSET_REFERENCE_TYPE
): REFERENCED_EXTENSION => ASSET_KINDS[assetKindForReference(type)].ext

export const isAssetUnused = ({ references }: ManagedAsset): boolean =>
  references.length === 0

export interface AssetReferenceSources {
  characters?: Character[]
  events?: Event[]
  scenes?: Scene[]
}

/**
 * Every place a storyworld can name an asset, keyed by asset id. There are four:
 * Character.masks[].assetId, Event.images[], Event.audio[0] and Scene.audio[0].
 */
export const collectAssetReferences = ({
  characters,
  events,
  scenes
}: AssetReferenceSources): Map<string, AssetReference[]> => {
  const references = new Map<string, AssetReference[]>()

  const add = (assetId: string | undefined, reference: AssetReference) => {
    if (!assetId) return

    const existing = references.get(assetId)

    existing ? existing.push(reference) : references.set(assetId, [reference])
  }

  characters?.forEach((character) =>
    character.masks.forEach((mask) =>
      add(mask.assetId, {
        type: ASSET_REFERENCE_TYPE.CHARACTER_MASK,
        elementId: character.id as ElementId,
        elementTitle: character.title,
        detail: mask.type
      })
    )
  )

  events?.forEach((event) => {
    event.images.forEach((imageId) =>
      add(imageId, {
        type: ASSET_REFERENCE_TYPE.EVENT_IMAGE,
        elementId: event.id as ElementId,
        elementTitle: event.title
      })
    )

    add(event.audio?.[0], {
      type: ASSET_REFERENCE_TYPE.EVENT_AUDIO,
      elementId: event.id as ElementId,
      elementTitle: event.title
    })
  })

  scenes?.forEach((scene) =>
    add(scene.audio?.[0], {
      type: ASSET_REFERENCE_TYPE.SCENE_AUDIO,
      elementId: scene.id as ElementId,
      elementTitle: scene.title
    })
  )

  return references
}

/**
 * Joins what is on disk to what the storyworld references. Assets referenced by
 * an element but absent from disk are included as `missing` entries rather than
 * dropped: a blank image in the composer is otherwise unexplained.
 *
 * Ordered so the actionable rows come first — missing, then unused, then in use
 * — and largest first within each group, which is the order that matters when
 * the point is to reclaim space.
 */
export const collateAssets = (
  files: AssetFile[],
  sources: AssetReferenceSources
): ManagedAsset[] => {
  const references = collectAssetReferences(sources),
    onDisk = new Set(files.map(({ id }) => id))

  const assets: ManagedAsset[] = files.map((file) => ({
    ...file,
    references: references.get(file.id) || [],
    missing: false
  }))

  references.forEach((assetReferences, assetId) => {
    if (onDisk.has(assetId)) return

    assets.push({
      id: assetId,
      ext: extensionForReference(assetReferences[0].type),
      bytes: 0,
      modified: 0,
      references: assetReferences,
      missing: true
    })
  })

  const rank = (asset: ManagedAsset) =>
    asset.missing ? 0 : isAssetUnused(asset) ? 1 : 2

  return assets.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      b.bytes - a.bytes ||
      (a.id > b.id ? 1 : a.id < b.id ? -1 : 0)
  )
}

export const totalAssetBytes = (assets: ManagedAsset[]): number =>
  assets.reduce((total, { bytes }) => total + bytes, 0)

export const formatAssetBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
