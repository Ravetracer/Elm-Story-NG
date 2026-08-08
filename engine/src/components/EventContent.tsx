import { eventContentToEventStreamContent } from '../lib/serialization'
import { flattenEventContent, getCharactersIdsFromEventContent } from '../lib'
import { useLiveQuery } from 'dexie-react-hooks'
import { getLibraryDatabase } from '../lib/db'

import React, { useContext, useEffect, useState } from 'react'
import reactStringReplace from 'react-string-replace'
import parseToHTML, { Element } from 'html-react-parser'

import {
  EngineLiveEventStateCollection,
  EventCharacterPersona,
  StudioId,
  WorldId,
  ElementId,
  EngineCharacterData,
  EngineLiveEventData
} from '../types'
import { PathProcessor } from './Event'
import { processTemplateBlock } from '../lib/state'

import { EngineContext } from '../contexts/EngineContext'

import EventCharacterReference from './EventCharacterReference'
import EventImageElement from './EventImageElement'
import EventCharacterElement from './EventCharacterElement'
import {
  CharacterElementStyleTypes,
  CharacterElementTransformType,
  EventContentNode
} from '../types/eventContentTypes'
import EventLinkElement from './EventLinkElement'
import EventInlineChoice from './EventInlineChoice'

const decorate = (
  template: string,
  state: EngineLiveEventStateCollection,
  highlightExpressions?: boolean
) => {
  const [processedTemplate, expressions] = processTemplateBlock(template, state)

  let matchExpressionCounter = 0

  return reactStringReplace(processedTemplate, /{([^}]+)}/g, (match) => {
    const matchedExpression = expressions[matchExpressionCounter]

    matchExpressionCounter++

    return highlightExpressions
      ? // prettier-ignore
        `<span className="${match === 'esg-error' ? `expression-error` : `expression`}" key="${`expression-${matchExpressionCounter}`}" title="${matchedExpression}">${match === 'esg-error' ? 'ERROR' : match}</span>`
      : match === 'esg-error'
      ? // prettier-ignore
        `<span className="expression-error" key="${`expression-${matchExpressionCounter}`}" title="${matchedExpression}">ERROR</span>`
      : //prettier-ignore
        `<span key="${`span-${matchExpressionCounter}`}">${match}</span>`
  })
}

const useCharacters = (studioId: StudioId, characterIds?: ElementId[]) => {
  const characters = useLiveQuery(
    async () => {
      if (!characterIds) return undefined

      const characters = await Promise.all(
        characterIds.map((id) =>
          getLibraryDatabase(studioId).characters.get(id)
        )
      )

      return characters.filter(
        (character): character is EngineCharacterData => character !== undefined
      )
    },
    [flattenEventContent],
    undefined
  )

  return characters
}

const EventContent: React.FC<{
  studioId: StudioId
  worldId: WorldId
  eventId: ElementId
  content: string
  persona?: EventCharacterPersona
  state: EngineLiveEventStateCollection
  /*
   * Both only so an inline choice can be taken from inside the prose. They are
   * threaded down rather than looked up here because the click has to reach the
   * same `processPath` the choice list calls: two routes into the stream would be
   * two chances to disagree about what taking a path does.
   */
  liveEvent: EngineLiveEventData
  onSubmitPath?: PathProcessor
}> = React.memo(({ studioId, worldId, eventId, content, persona, state, liveEvent, onSubmitPath }) => {
  const { engine } = useContext(EngineContext)

  let parsedContentAsJSON: EventContentNode[] | undefined,
    referencedCharacterIds: ElementId[] | undefined

  // #PWA: also for local testing
  if (engine.isComposer) {
    // elmstorygames/feedback#245
    const parsed: EventContentNode[] = JSON.parse(content)

    parsedContentAsJSON = parsed
    referencedCharacterIds = getCharactersIdsFromEventContent(parsed)
  }

  const characters = useCharacters(studioId, referencedCharacterIds)

  const [parsedContent, setParsedContent] = useState<
    string | JSX.Element | JSX.Element[]
  >('')

  useEffect(() => {
    async function serializeAndParseContent() {
      if (!content) return

      // #PWA: use this for local dev as well
      if (engine.isComposer && parsedContentAsJSON) {
        const serializedContent = await eventContentToEventStreamContent(
          studioId,
          worldId,
          parsedContentAsJSON,
          engine.isComposer
        )

        setParsedContent(
          parseToHTML(
            decorate(
              serializedContent.text,
              state,
              engine.devTools.highlightExpressions
            ).join(''),
            {
              replace: (node) => {
                if (node instanceof Element && node.attribs) {
                  if (node.attribs['data-type'] === 'link') {
                    return (
                      <EventLinkElement
                        url={node.attribs['data-url']}
                        text={node.attribs['data-text']}
                      />
                    )
                  }

                  if (node.attribs['data-type'] === 'img') {
                    const assetId =
                      node.attribs['data-asset-id'] === 'undefined'
                        ? undefined
                        : node.attribs['data-asset-id']
                    return (
                      <EventImageElement eventId={eventId} assetId={assetId} />
                    )
                  }

                  if (node.attribs['data-type'] === 'character') {
                    const characterId =
                        node.attribs['data-character-id'] === 'undefined'
                          ? undefined
                          : node.attribs['data-character-id'],
                      aliasId =
                        node.attribs['data-character-alias-id'] === 'undefined'
                          ? undefined
                          : node.attribs['data-character-alias-id'],
                      transform =
                        node.attribs['data-character-ref-transform'] ===
                        'undefined'
                          ? undefined
                          : node.attribs['data-character-ref-transform'],
                      styles =
                        node.attribs['data-character-ref-styles'] ===
                        'undefined'
                          ? undefined
                          : node.attribs['data-character-ref-styles'].split(',')

                    return (
                      <EventCharacterElement
                        studioId={studioId}
                        characterId={characterId}
                        aliasId={aliasId}
                        highlight={engine.devTools.highlightCharacters}
                        transform={
                          transform as CharacterElementTransformType | undefined
                        }
                        styles={
                          styles as CharacterElementStyleTypes | undefined
                        }
                      />
                    )
                  }

                  if (node.attribs['data-type'] === 'choice') {
                    return (
                      <EventInlineChoice
                        studioId={studioId}
                        choiceId={
                          node.attribs['data-choice-id'] === 'undefined'
                            ? undefined
                            : node.attribs['data-choice-id']
                        }
                        liveEvent={liveEvent}
                        liveEventResult={liveEvent.result}
                        onSubmitPath={onSubmitPath}
                      />
                    )
                  }
                }

                return node
              }
            }
          )
        )
      }

      // #PWA: disable full block for local dev
      if (!engine.isComposer) {
        setParsedContent(
          parseToHTML(
            decorate(content, state, engine.devTools.highlightExpressions).join(
              ''
            ),
            /*
             * An exported world's content is the HTML baked at export time, so
             * nothing here needed replacing until now: a character reference had
             * already become its name and an image its own element.
             *
             * An inline choice cannot be baked — whether its path is open depends
             * on the state the player arrived with — so `eventContentToHTML` leaves
             * the same placeholder span the composer emits, and this is where the
             * exported PWA turns it back into something clickable. Without this the
             * feature works in the preview and is an invisible empty span in every
             * export, which is the failure this whole branch is prone to.
             */
            {
              replace: (node) => {
                if (
                  node instanceof Element &&
                  node.attribs &&
                  node.attribs['data-type'] === 'choice'
                ) {
                  return (
                    <EventInlineChoice
                      studioId={studioId}
                      choiceId={
                        node.attribs['data-choice-id'] === 'undefined'
                          ? undefined
                          : node.attribs['data-choice-id']
                      }
                      liveEvent={liveEvent}
                      liveEventResult={liveEvent.result}
                      onSubmitPath={onSubmitPath}
                    />
                  )
                }

                return node
              }
            }
          )
        )
      }
    }

    serializeAndParseContent()
    /*
     * `liveEvent` and `onSubmitPath` are dependencies because the parsed content is
     * held in state: the `EventInlineChoice` elements built above capture whatever
     * these were when the effect last ran, and a captured live event is a stale
     * one — its `result` decides whether the choice is still clickable and its
     * `state` decides whether the path is open at all. This is the same staleness
     * that made the passthrough arrow fire a pre-take closure; see
     * `gotoNextLiveEvent`, which reads the stored record for the other half of it.
     *
     * The cost is re-parsing this one event's content when its own live event row
     * changes, which is exactly when what the prose offers can have changed.
     */
  }, [content, characters, engine.devTools, liveEvent, onSubmitPath])

  return (
    <div>
      {persona && <EventCharacterReference persona={persona} />}

      {/* If we wanted to render an image above the persona */}
      {/* {serializedContent?.startingElement &&
        parseToHTML(serializedContent?.startingElement)} */}

      {parsedContent}
    </div>
  )
})

EventContent.displayName = 'EventContent'

export default EventContent
