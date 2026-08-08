import { Howl, Howler } from 'howler'

import { useCallback, useContext, useEffect, useState } from 'react'
import { EngineContext } from '../../contexts/EngineContext'
import {
  AudioProfile,
  EngineDevToolsLiveEvent,
  ENGINE_DEVTOOLS_LIVE_EVENTS,
  ENGINE_DEVTOOLS_LIVE_EVENT_TYPE
} from '../../types'

export type AudioMixerProfiles = { scene?: AudioProfile; event?: AudioProfile }
export type AudioTrackType = 'SCENE' | 'EVENT'
export type AudioTrack = [AudioSubTrack, AudioSubTrack]
export type AudioSubTrack = { source?: string; audio?: Howl; primary: boolean }

/**
 * Chromium suspends the shared AudioContext on its own: under the autoplay
 * policy before the first gesture, and again whenever the renderer is
 * backgrounded or the preview is hidden behind another dock tab. Howler tracks
 * only its own `Howler.state` and never observes the context, so the two
 * desync, leaving `Howler.state === 'running'` while the context is actually
 * `'suspended'`.
 *
 * That desync is silent and permanent. `Howl.play()` calls
 * `Howler._autoResume()`, which resumes only when `Howler.state` itself reads
 * `'suspended'`; in the desynced state it takes the other branch and returns
 * without touching the context. `play()` then reports success and `playing()`
 * returns true, but `Howler.ctx.currentTime` never advances, so the gain ramps
 * that `fade()` schedules never progress and `seek()` stays at 0. No audio is
 * ever heard.
 *
 * `state` is absent from @types/howler, hence the cast. Keeping it in step with
 * the real context also repairs Howler's own internal `_autoResume()` calls.
 */
const observeAudioContextState = (ctx: AudioContext) => {
  const observed = ctx as AudioContext & { esgStateObserved?: boolean }

  if (observed.esgStateObserved) return

  observed.esgStateObserved = true

  ctx.addEventListener('statechange', () => {
    ;(Howler as unknown as { state: AudioContextState }).state = ctx.state
  })
}

/**
 * Resolves once the context is running, so callers can schedule playback and
 * gain ramps against a clock that is actually advancing. `resume()` is
 * asynchronous, which is why the fade cannot simply follow `play()` on the same
 * tick.
 */
const resumeAudioContext = async () => {
  const ctx = Howler.ctx

  // Howler falls back to HTML5 Audio where Web Audio is unavailable, and then
  // has no context to resume.
  if (!ctx || !Howler.usingWebAudio) return

  observeAudioContextState(ctx)

  // Howler otherwise suspends the context itself after a spell with nothing
  // playing, which is a second way to arrive at the desync above.
  Howler.autoSuspend = false

  if (ctx.state === 'running') return

  try {
    await ctx.resume()
  } catch (error) {
    // A resume before the first user gesture is rejected by the autoplay
    // policy. The next call, driven by a gesture, succeeds.
    return
  }

  ;(Howler as unknown as { state: AudioContextState }).state = ctx.state
}

const useAudioTrack = ({
  source,
  loop,
  paused,
  volume,
  onEnd
}: {
  type: AudioTrackType
  source?: string
  muted: boolean
  loop?: boolean
  paused: boolean
  volume?: number
  // Fired when a non-looping sound finishes playing. Used to lift the scene
  // duck once a one-shot event clip (a door closing) has run its course.
  onEnd?: () => void
}) => {
  const { engine } = useContext(EngineContext)

  const [track, setTrack] = useState<AudioTrack>([
    { source: undefined, audio: undefined, primary: true },
    { source: undefined, audio: undefined, primary: false }
  ])

  const updateTrack = useCallback(
    (source?: string) => {
      const audio = source
        ? new Howl({ src: source, loop, autoplay: true, html5: false })
        : undefined

      // Howler emits 'end' only on natural completion (and once per loop),
      // never on stop(), so a cross-faded-out track does not trigger this — only
      // a clip that plays to its end. Looping tracks are excluded so an ambient
      // event track keeps the scene ducked rather than lifting it every loop.
      if (audio && onEnd && !loop) audio.on('end', onEnd)

      if (!track[0].source) {
        setTrack([{ source, audio, primary: true }, { ...track[1] }])

        return
      }

      // if (!source) return

      // for cross-fading
      const primarySubTrackIndex = track.findIndex(
          (subTrack) => subTrack.primary
        ),
        existingPrimarySubTrack: AudioSubTrack = {
          ...track[primarySubTrackIndex],
          primary: false
        },
        newPrimarySubTrack: AudioSubTrack = {
          source,
          audio,
          primary: true
        }

      setTrack(
        primarySubTrackIndex === 0
          ? [existingPrimarySubTrack, newPrimarySubTrack]
          : [newPrimarySubTrack, existingPrimarySubTrack]
      )
    },
    [track]
  )

  const pause = useCallback(() => {
    track[0].audio?.pause()
    track[1].audio?.pause()
  }, [track])

  const stop = useCallback(() => {
    track[0].audio?.stop()
    track[1].audio?.stop()
  }, [track])

  const play = useCallback(() => {
    // elmstorygames/feedback#268
    resumeAudioContext().then(() => {
      track[0].primary && track[0].audio?.play()
      track[1].primary && track[1].audio?.play()
    })
  }, [track])

  useEffect(() => updateTrack(source), [source])

  useEffect(() => {
    const subTrackToFadeOut = track.find((subTrack) => !subTrack.primary),
      subTrackToFadeIn = track.find((subTrack) => subTrack.primary)

    if (subTrackToFadeOut?.audio) {
      subTrackToFadeOut.audio.once('fade', () => {
        subTrackToFadeOut.audio?.stop()

        // Restoring this needs the faded-out sub-track's index, which was
        // previously captured by a write-only variable in the find() above.
        // Use track.findIndex((subTrack) => !subTrack.primary) instead.
        //
        // const resetSubTrack: AudioSubTrack = {
        //   source: undefined,
        //   audio: undefined,
        //   primary: false
        // }

        // setTrack(
        //   fadedOutIndex === 0
        //     ? [{ ...resetSubTrack }, { ...track[1] }]
        //     : [{ ...track[0] }, { ...resetSubTrack }]
        // )
      })

      subTrackToFadeOut.audio.fade(volume || 1, 0, 1000)
    }

    if (subTrackToFadeIn?.audio) {
      const audioToFadeIn = subTrackToFadeIn.audio

      // The ramp below is scheduled against Howler.ctx.currentTime, so the
      // context has to be running before any of this is issued.
      resumeAudioContext().then(() => {
        audioToFadeIn.volume(0)
        audioToFadeIn.play()
        audioToFadeIn.fade(0, volume || 1, 1000)
      })
    }

    return () => {
      engine.isComposer && stop()
    }
  }, [track])

  useEffect(() => {
    const audioToChange = track.find((subTrack) => subTrack.primary)?.audio

    if (!audioToChange) return

    // As above: a ramp issued against a suspended context never progresses.
    resumeAudioContext().then(() =>
      audioToChange.fade(audioToChange.volume(), volume || 1, 1000)
    )
  }, [volume])

  // elmstorygames/feedback#268
  useEffect(() => {
    if (paused) {
      pause()
    }

    if (!paused) {
      play()
    }
  }, [paused])

  // elmstorygames/feedback#289
  useEffect(() => {
    if (!engine.playing) {
      stop()
    }

    if (engine.playing) {
      play()
    }
  }, [engine.playing])

  return [
    { source: track[0].source, primary: track[0].primary },
    { source: track[1].source, primary: track[1].primary }
  ]
}

export const useAudioMixer = ({
  profiles,
  muted,
  paused
}: {
  profiles: AudioMixerProfiles
  muted: boolean
  paused: boolean
}) => {
  const { engine } = useContext(EngineContext)

  const [resolvedAudioSceneUrl, setResolvedAudioSceneUrl] = useState<
      string | undefined
    >(undefined),
    [resolvedAudioEventUrl, setResolvedAudioEventUrl] = useState<
      string | undefined
    >(undefined)

  // The scene ducks while an event is playing audio, then rises again on its
  // own once a one-shot clip finishes — rather than staying ducked until the
  // next event, which is what happened when the scene volume was tied directly
  // to `profiles.event`. A short effect (a door closing) makes room and the
  // scene music returns; a looping event track keeps the duck (it never ends).
  const [eventAudioDucking, setEventAudioDucking] = useState(false)

  const onEventAudioEnd = useCallback(() => setEventAudioDucking(false), [])

  const eventAudioId = profiles.event?.[0]

  // Duck when an event brings audio (keyed on the id, a primitive, so a new
  // `profiles` object with the same audio does not re-duck after a clip ended).
  useEffect(() => {
    setEventAudioDucking(Boolean(eventAudioId))
  }, [eventAudioId])

  const processEvent = (event: Event) => {
    const { detail } = event as CustomEvent<EngineDevToolsLiveEvent>

    if (detail.eventType === ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.RETURN_ASSET_URL) {
      if (
        detail?.asset?.url &&
        detail?.asset.id &&
        engine.currentLiveEvent === detail.eventId
      ) {
        if (
          detail.asset.for === 'SCENE' &&
          detail.asset.id === profiles.scene?.[0]
        ) {
          // replaceAll('"', "'")
          setResolvedAudioSceneUrl(detail.asset.url.replaceAll('"', ''))
        }

        if (
          detail.asset.for === 'EVENT' &&
          detail.asset.id === profiles.event?.[0]
        ) {
          // replaceAll('"', "'")
          setResolvedAudioEventUrl(detail.asset.url.replaceAll('"', ''))
        }
      } else {
        if (detail?.asset?.for === 'SCENE') {
          setResolvedAudioSceneUrl(undefined)
        }

        if (detail?.asset?.for === 'EVENT') {
          setResolvedAudioEventUrl(undefined)
        }
      }
    }
  }

  useEffect(() => {
    async function getAudioUrls() {
      if (engine.isComposer) {
        if (profiles.scene) {
          window.dispatchEvent(
            new CustomEvent<EngineDevToolsLiveEvent>(
              ENGINE_DEVTOOLS_LIVE_EVENTS.ENGINE_TO_COMPOSER,
              {
                detail: {
                  eventType: ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.GET_ASSET_URL,
                  eventId: engine.currentLiveEvent,
                  asset: {
                    id: profiles.scene[0],
                    for: 'SCENE',
                    ext: 'mp3'
                  }
                }
              }
            )
          )
        } else {
          setResolvedAudioSceneUrl(undefined)
        }

        if (profiles.event) {
          window.dispatchEvent(
            new CustomEvent<EngineDevToolsLiveEvent>(
              ENGINE_DEVTOOLS_LIVE_EVENTS.ENGINE_TO_COMPOSER,
              {
                detail: {
                  eventType: ENGINE_DEVTOOLS_LIVE_EVENT_TYPE.GET_ASSET_URL,
                  eventId: engine.currentLiveEvent,
                  asset: {
                    id: profiles.event[0],
                    for: 'EVENT',
                    ext: 'mp3'
                  }
                }
              }
            )
          )
        } else {
          setResolvedAudioEventUrl(undefined)
        }
      }
    }

    getAudioUrls()
  }, [engine.currentLiveEvent, profiles, engine.devTools])

  useEffect(() => {
    if (engine.isComposer) {
      window.addEventListener(
        ENGINE_DEVTOOLS_LIVE_EVENTS.COMPOSER_TO_ENGINE,
        processEvent
      )
    }

    return () => {
      if (engine.isComposer) {
        window.removeEventListener(
          ENGINE_DEVTOOLS_LIVE_EVENTS.COMPOSER_TO_ENGINE,
          processEvent
        )
      }
    }
  }, [engine.currentLiveEvent, profiles, engine.devTools])

  const sceneTrack = useAudioTrack({
      type: 'SCENE',
      // #DEV
      // source: profiles.scene?.[0]
      //   ? `../../data/0-7-test/assets/${profiles.scene[0]}.mp3`
      //   : undefined,
      // #PWA
      source: !engine.isComposer
        ? profiles.scene?.[0]
          ? `assets/content/${profiles.scene[0]}.mp3`
          : undefined
        : resolvedAudioSceneUrl,
      muted,
      loop: profiles.scene?.[1],
      paused,
      volume: muted ? -1 : eventAudioDucking ? 0.3 : 1
    }),
    eventTrack = useAudioTrack({
      type: 'EVENT',
      // #DEV
      // source: profiles.event?.[0]
      //   ? `../../data/0-7-test/assets/${profiles.event[0]}.mp3`
      //   : undefined,
      // #PWA
      source: !engine.isComposer
        ? profiles.event?.[0]
          ? `assets/content/${profiles.event[0]}.mp3`
          : undefined
        : resolvedAudioEventUrl,
      muted,
      loop: profiles.event?.[1],
      paused,
      volume: muted ? -1 : 1,
      onEnd: onEventAudioEnd
    })

  return { sceneTrack, eventTrack }
}
