import {
  Character,
  CHARACTER_MASK_TYPE,
  ElementId,
  Event,
  Scene,
  World,
  WorldObject
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

/**
 * Whether a WebP file's bytes carry animation, read from the VP8X extended
 * header's animation flag.
 *
 * An animated WebP must skip the crop pipeline: `getCroppedImageData` re-encodes
 * through a canvas, which keeps only the first frame, so the file is stored as
 * its original bytes instead. Only WebP is detected — GIF and APNG would each
 * need a second extension per kind, breaking the one-extension-per-kind invariant
 * every asset read site depends on, so they stay out.
 */
export const isAnimatedWebP = (buffer: ArrayBuffer): boolean => {
  const bytes = new Uint8Array(buffer)

  // 'RIFF' <size> 'WEBP' 'VP8X' <size> <flags…>; the flags byte is at 20 and its
  // animation bit is 0x02. A file shorter than that cannot be an animated WebP.
  if (bytes.length < 21) return false

  const tag = (offset: number) =>
    String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    )

  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return false

  // Only the extended 'VP8X' form carries the flags; a plain still WebP is 'VP8 '
  // or 'VP8L' and is never animated.
  if (tag(12) !== 'VP8X') return false

  return (bytes[20] & 0x02) !== 0
}

export const assetMedia = ({ ext }: { ext: string }): ASSET_MEDIA => {
  if (IMAGE_EXTENSIONS.includes(ext)) return ASSET_MEDIA.IMAGE
  if (AUDIO_EXTENSIONS.includes(ext)) return ASSET_MEDIA.AUDIO

  return ASSET_MEDIA.OTHER
}

export enum ASSET_REFERENCE_TYPE {
  CHARACTER_MASK = 'CHARACTER_MASK',
  EVENT_IMAGE = 'EVENT_IMAGE',
  EVENT_AUDIO = 'EVENT_AUDIO',
  /**
   * An object's two image slots are two reference types over one kind, the way
   * event and scene audio are. They have to be distinguishable, because clearing
   * a reference means clearing a *named field* — `assetId` or `stackedAssetId` —
   * and a single type would leave the manager unable to tell which.
   */
  OBJECT_IMAGE = 'OBJECT_IMAGE',
  OBJECT_STACKED_IMAGE = 'OBJECT_STACKED_IMAGE',
  SCENE_AUDIO = 'SCENE_AUDIO',
  WORLD_COVER = 'WORLD_COVER',
  WORLD_BACKGROUND = 'WORLD_BACKGROUND'
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
 * Square, because one asset has to serve both an inventory tile and the inspect
 * panel. A 16:9 crop in a tile is mostly padding.
 */
export const OBJECT_IMAGE_PIPELINE: ImageAssetPipeline = {
  aspectRatio: 1,
  size: { width: 400, height: 400 },
  format: 'webp',
  quality: 0.8
}

/**
 * Deliberately identical to `EVENT_IMAGE_PIPELINE`, and a separate constant
 * rather than an alias so changing one does not silently change the other.
 *
 * Sharing the numbers is not the "nearly right" hazard the character mask comment
 * warns about — that is about an asset processed *differently* from what a read
 * site expects. Two kinds with byte-identical processing are interchangeable by
 * construction, and since the picker filters on extension, an event image can be
 * chosen as a cover. That is a convenience rather than a bug. The kind still
 * exists separately so the import menu can label it, because nothing on disk
 * distinguishes a webp meant as a cover from one meant as an event image.
 */
export const WORLD_COVER_PIPELINE: ImageAssetPipeline = {
  aspectRatio: 16 / 9,
  size: { width: 655 * 2, height: 368 * 2 },
  format: 'webp',
  quality: 0.7
}

/**
 * A landscape 16:9 at a larger size than the cover, because it fills the whole
 * window behind the reading column rather than sitting in a card. The author
 * positions the crop, so a 16:9 background is a chosen region rather than a blind
 * one; `background-size: cover` in the engine then fills whatever the viewport is.
 */
export const WORLD_BACKGROUND_PIPELINE: ImageAssetPipeline = {
  aspectRatio: 16 / 9,
  size: { width: 1920, height: 1080 },
  format: 'webp',
  quality: 0.8
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
  OBJECT_IMAGE = 'OBJECT_IMAGE',
  WORLD_COVER = 'WORLD_COVER',
  WORLD_BACKGROUND = 'WORLD_BACKGROUND',
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
  [ASSET_KIND.OBJECT_IMAGE]: {
    label: 'Object Image',
    ext: 'webp',
    accept: 'image/*',
    pipeline: OBJECT_IMAGE_PIPELINE
  },
  [ASSET_KIND.WORLD_COVER]: {
    label: 'Storyworld Cover',
    ext: 'webp',
    accept: 'image/*',
    pipeline: WORLD_COVER_PIPELINE
  },
  [ASSET_KIND.WORLD_BACKGROUND]: {
    label: 'Storyworld Background',
    ext: 'webp',
    accept: 'image/*',
    pipeline: WORLD_BACKGROUND_PIPELINE
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
    case ASSET_REFERENCE_TYPE.OBJECT_IMAGE:
    case ASSET_REFERENCE_TYPE.OBJECT_STACKED_IMAGE:
      return ASSET_KIND.OBJECT_IMAGE
    case ASSET_REFERENCE_TYPE.WORLD_COVER:
      return ASSET_KIND.WORLD_COVER
    case ASSET_REFERENCE_TYPE.WORLD_BACKGROUND:
      return ASSET_KIND.WORLD_BACKGROUND
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
  objects?: WorldObject[]
  scenes?: Scene[]
  /** the storyworld record itself, for its cover */
  world?: World
}

/**
 * Every place a storyworld can name an asset, keyed by asset id. There are eight
 * as of 0.8.0: Character.masks[].assetId, Event.images[], Event.audio[0],
 * Scene.audio[0], WorldObject.assetId, WorldObject.stackedAssetId,
 * World.coverAssetId and World.backgroundAssetId.
 *
 * **This function has to cover all of them or the manager offers to delete a file
 * that is in use**, which is why a new writer belongs here in the same change that
 * introduces it. Note that a caller passing an incomplete `sources` gets an
 * incomplete count — every field is optional, so an omission is silent.
 */
export const collectAssetReferences = ({
  characters,
  events,
  objects,
  scenes,
  world
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

  objects?.forEach((object) => {
    add(object.assetId, {
      type: ASSET_REFERENCE_TYPE.OBJECT_IMAGE,
      elementId: object.id as ElementId,
      elementTitle: object.title
    })

    add(object.stackedAssetId, {
      type: ASSET_REFERENCE_TYPE.OBJECT_STACKED_IMAGE,
      elementId: object.id as ElementId,
      elementTitle: object.title
    })
  })

  scenes?.forEach((scene) =>
    add(scene.audio?.[0], {
      type: ASSET_REFERENCE_TYPE.SCENE_AUDIO,
      elementId: scene.id as ElementId,
      elementTitle: scene.title
    })
  )

  if (world) {
    add(world.coverAssetId, {
      type: ASSET_REFERENCE_TYPE.WORLD_COVER,
      elementId: world.id as ElementId,
      elementTitle: world.title
    })

    add(world.backgroundAssetId, {
      type: ASSET_REFERENCE_TYPE.WORLD_BACKGROUND,
      elementId: world.id as ElementId,
      elementTitle: world.title
    })
  }

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
