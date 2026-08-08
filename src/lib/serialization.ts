// #UPDATE
import { ipcRenderer } from 'electron'
import { getSvgUrl } from '.'

import { ImageSelectPlaceholder } from '../components/ElementEditor/EventContent/Tools/ImageElementSelect'

import { StudioId, WorldId } from '../../engine/src/types'
import { Choice } from '../data/types'
import { ELEMENT_FORMATS, EventContentNode } from '../data/eventContentTypes'
import {
  getCharacterAliasOrTitle,
  getCharacterRefDisplayFormat
} from './contentEditor'
import { WINDOW_EVENT_TYPE } from './events'

import api from '../api'

const serializeDescendantToText = async (
  studioId: StudioId,
  worldId: WorldId,
  node: EventContentNode
): Promise<string> => {
  if (node.text) {
    return node.text
  }

  const text: string = node.children
    ? `<div>${(
        await Promise.all(
          node.children.map(
            async (childNode) =>
              await serializeDescendantToText(
                studioId,
                worldId,
                childNode as EventContentNode
              )
          )
        )
      ).join('')}</div>`
    : ''

  switch (node.type) {
    case ELEMENT_FORMATS.LINK:
      return `<span title="${
        node.url ||
        'Missing link URL. Text will display without link in publication.'
      }" class="event-content-preview-link ${
        !node.url ? 'event-content-preview-link-missing' : ''
      }">${node.children[0].text}</span>`
    case ELEMENT_FORMATS.IMG:
      const [path, exists]: [string, boolean] = await ipcRenderer.invoke(
        WINDOW_EVENT_TYPE.GET_ASSET,
        {
          studioId,
          worldId,
          id: node.asset_id,
          ext: 'webp'
        }
      )

      // A chosen image whose file is gone — e.g. trashed from the asset manager —
      // shows a distinct missing state rather than the same placeholder as an
      // unassigned slot, mirroring the missing-link treatment above.
      const imageMissing = !exists && Boolean(node.asset_id)

      return `<div class="event-content-preview-image${
        imageMissing ? ' event-content-preview-image-missing' : ''
      }" style="background-image: url(${
        exists ? path.replaceAll('"', "'") : getSvgUrl(ImageSelectPlaceholder)
      });"></div>`
    case ELEMENT_FORMATS.CHARACTER:
      const character = node.character_id
        ? await api().characters.getCharacter(studioId, node.character_id)
        : undefined

      return character
        ? `<span class="event-content-preview-character" title="Character: ${
            character.title
          }">${
            getCharacterRefDisplayFormat(
              (await getCharacterAliasOrTitle(character, node.alias_id)) || '',
              node.transform || 'cap'
            ).text
          }</span>`
        : `<span data-type="missing-character" data-character-id="${node.character_id}"></span>`
    case ELEMENT_FORMATS.CHOICE:
      // A scene map node preview is read, never clicked, so an inline choice is
      // resolved to its title here — the same treatment the character reference
      // above gets, and for the same reason: this is the only one of the three
      // serializers whose output nothing interactive is built from.
      /*
       * `getChoice` throws when the row is gone, and a node can outlive the choice
       * it names: deleting a choice from the scene map does not reach into the
       * document, deliberately. Rewriting the content from outside would be
       * overwritten by an open content editor's next debounced save — the same
       * reason the asset manager refuses to clear an event image reference — so a
       * dangling node renders as nothing here and offers nothing to click in the
       * engine, rather than being repaired behind the author's back.
       */
      let choice: Choice | undefined

      try {
        choice = node.choice_id
          ? await api().choices.getChoice(studioId, node.choice_id)
          : undefined
      } catch (error) {
        choice = undefined
      }

      return choice
        ? `<span class="event-content-preview-choice" title="Inline choice: ${choice.title}">${choice.title}</span>`
        : ''
    case ELEMENT_FORMATS.OL:
    case ELEMENT_FORMATS.UL:
      return node.children
        ? `<div>${(
            await Promise.all(
              node.children.map(
                async (childNode) =>
                  await serializeDescendantToText(
                    studioId,
                    worldId,
                    childNode as EventContentNode
                  )
              )
            )
          ).join('')}</div>`
        : ''
    default:
      return text
  }
}

export const eventContentToPreview = async (
  studioId: StudioId,
  worldId: WorldId,
  content: string
): Promise<{ asset_id?: string; text?: string }> => {
  const children: EventContentNode[] = JSON.parse(content)

  const text = (
    await Promise.all(
      children
        // .filter((childNode) => isTextNode(childNode))
        .map(
          async (childNode) =>
            await serializeDescendantToText(studioId, worldId, childNode)
        )
    )
  )
    .filter((text) => text)
    .join('')

  return {
    asset_id:
      children[0].type === ELEMENT_FORMATS.IMG
        ? children[0].asset_id || undefined
        : undefined,
    text: text === '<div></div>' ? undefined : text
  }
}
