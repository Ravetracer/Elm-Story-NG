import React from 'react'

import { ELEMENT_TYPE } from '../../data/types'

/**
 * In-app help, one entry per topic, rendered by the `?` buttons that used to open
 * docs.elmstory.com — a domain that no longer resolves. Written against the code
 * rather than ported from the archived docs, which are mostly "WIP" stubs and in
 * places wrong (they document a `=/=` operator that has never parsed).
 *
 * The pattern is `VariableManager/VariableHelp.tsx`: accurate, in the app, and
 * kept in step with what the editor actually does. Anything about template
 * expressions lives there rather than being duplicated here, so the two cannot
 * drift — this content points at the variables help instead of restating it.
 */
export type HelpTopic =
  | ELEMENT_TYPE
  | 'OVERVIEW_DASHBOARD'
  | 'OVERVIEW_COMPOSER'
  | 'EXPORT_JSON'
  | 'EXPORT_PWA'
  | 'IMPORT'

export interface HelpEntry {
  title: string
  body: React.ReactNode
}

export const HELP_CONTENT: Partial<Record<HelpTopic, HelpEntry>> = {
  OVERVIEW_DASHBOARD: {
    title: 'The dashboard',
    body: (
      <>
        <p>
          Where you pick a studio and open a storyworld. It is the first screen
          the app opens on.
        </p>
        <ul>
          <li>
            A <strong>studio</strong> groups your storyworlds. Choose one from{' '}
            <strong>Select studio…</strong> first — the storyworlds below belong
            to it.
          </li>
          <li>
            Click a storyworld to open it in the <strong>Composer</strong>, or
            create a new one.
          </li>
          <li>
            <strong>Import</strong> a storyworld from a <code>.json</code> export.
            Its images and audio come from an <code>assets</code> folder beside
            the file, so import through the picker rather than dragging the JSON
            in alone.
          </li>
          <li>
            Export a storyworld as JSON or as a playable web app (PWA) from its
            menu.
          </li>
        </ul>
      </>
    )
  },
  OVERVIEW_COMPOSER: {
    title: 'The composer',
    body: (
      <>
        <p>
          Where a storyworld is built. Four areas: the{' '}
          <strong>storyworld outline</strong> on the left, the{' '}
          <strong>editor</strong> in the middle, the{' '}
          <strong>inspector</strong> on the right, and a live{' '}
          <strong>Preview</strong> that plays what you have so far.
        </p>
        <h4>Outline</h4>
        <p>
          Folders hold scenes, scenes hold events. Click a scene to open its{' '}
          <strong>scene map</strong>; click an event to edit its content. The
          title bar above the outline opens the asset manager, the storyworld
          map, the variable manager and interface text.
        </p>
        <h4>Scene map</h4>
        <ul>
          <li>
            Nodes are events and jumps; lines are the <strong>paths</strong>{' '}
            between them.
          </li>
          <li>
            <strong>Cut, copy, paste, duplicate</strong> —{' '}
            <code>Ctrl/Cmd+X/C/V/D</code>, or the toolbar.
          </li>
          <li>
            <strong>Auto Layout</strong> arranges the whole scene;{' '}
            <strong>Undo Auto Layout</strong> beside it reverts.
          </li>
        </ul>
        <h4>Writing an event</h4>
        <ul>
          <li>
            Type <code>/</code> for a menu — headings, lists, an image, a
            character reference, an inline choice.
          </li>
          <li>
            Type <code>{'{'}</code> for a template expression. The Variables tab&apos;s{' '}
            <code>?</code> documents the expression language.
          </li>
        </ul>
        <h4>Getting out of the way</h4>
        <ul>
          <li>
            <strong>Distraction-free mode</strong> — <code>Ctrl/Cmd+Shift+F</code>{' '}
            hides the panels around the writing column; <code>Escape</code> steps
            back out.
          </li>
          <li>
            <strong>UI size</strong> — the <code>Aa</code> button in the title
            bar (or <code>Ctrl+Alt+</code> <code>+</code> / <code>-</code> /{' '}
            <code>0</code>) scales the whole interface.
          </li>
        </ul>
        <p>
          The Preview reinstalls the storyworld each time it opens, so it always
          reflects the current draft.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.WORLD]: {
    title: 'The storyworld',
    body: (
      <>
        <p>
          The root of everything in the outline — the storyworld itself. Its
          properties describe it and set how it presents to the player.
        </p>
        <h4>Description</h4>
        <p>Title, description, designer, copyright, website and tags.</p>
        <h4>Presentation</h4>
        <ul>
          <li>
            <strong>Cover</strong> and <strong>Background</strong> images.
          </li>
          <li>
            <strong>Colours</strong> layer over the player&apos;s theme — a
            colour left off keeps the theme&apos;s own.
          </li>
          <li>
            <strong>Transition</strong> — how each new event enters the stream
            (Fade, Slide or None).
          </li>
          <li>
            <strong>Choices</strong> — the default way a set of choices is laid
            out (List, Row or Modal), overridable per event.
          </li>
          <li>
            <strong>Interface Text</strong> — every word the storyteller says
            that you did not write.
          </li>
        </ul>
        <p>
          The world&apos;s <strong>start</strong> jump decides which event play
          begins on.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.FOLDER]: {
    title: 'A folder',
    body: (
      <>
        <p>
          An outline-only grouping. It holds scenes and other folders to keep a
          large storyworld tidy.
        </p>
        <p>
          A folder is never played and has no effect on the story — removing one
          changes the arrangement, not what happens.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.SCENE]: {
    title: 'A scene',
    body: (
      <>
        <p>
          A container for events and the jumps between them. The events inside
          are joined by paths.
        </p>
        <ul>
          <li>
            A path never leaves the scene — only a <strong>jump</strong> crosses
            a scene boundary.
          </li>
          <li>
            An optional <strong>audio</strong> profile plays while the scene is on
            screen.
          </li>
          <li>
            A <strong>scene-scoped</strong> variable resets to its initial value
            when the player enters the scene.
          </li>
        </ul>
      </>
    )
  },
  [ELEMENT_TYPE.EVENT]: {
    title: 'An event',
    body: (
      <>
        <p>
          A page of the story — its prose and what the player does next. An event
          is one of three types:
        </p>
        <ul>
          <li>
            <strong>Choice</strong> — options the player picks from.
          </li>
          <li>
            <strong>Input</strong> — a text field the player types into.
          </li>
          <li>
            <strong>Jump</strong> — hands play off elsewhere.
          </li>
        </ul>
        <h4>Writing the prose</h4>
        <ul>
          <li>
            Type <code>/</code> for a menu: headings, lists, an image, a character
            reference, an inline choice.
          </li>
          <li>
            Type <code>{'{'}</code> for a template expression — see the variables
            help (the <code>?</code> on the Variables tab) for the language.
          </li>
        </ul>
        <p>
          An event can carry an image and an audio profile, and can override the
          storyworld&apos;s choice layout.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.CHOICE]: {
    title: 'A choice',
    body: (
      <>
        <p>
          An option that leads out of a Choice event along a path. Its title is
          the label the player clicks.
        </p>
        <ul>
          <li>
            The title is the one source of truth — renaming it updates the list,
            the scene map and any inline mention at once.
          </li>
          <li>
            A choice can be moved into the prose as an <strong>inline choice</strong>{' '}
            (<code>/</code> → Inline Choice) without losing its paths.
          </li>
        </ul>
      </>
    )
  },
  [ELEMENT_TYPE.CONDITION]: {
    title: 'A condition',
    body: (
      <>
        <p>
          Gates a path on a variable. The path is only offered to the player when
          the comparison holds.
        </p>
        <p>
          Operators: <code>=</code>, <code>!=</code>, <code>&gt;</code>,{' '}
          <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>.
        </p>
        <p>
          A path may carry several. <strong>All</strong> requires every one to
          hold; <strong>Any</strong> requires one.
        </p>
        <p>
          <code>!=</code> is the inequality operator. <code>=/=</code> is not
          supported and never was.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.EFFECT]: {
    title: 'An effect',
    body: (
      <>
        <p>Changes a variable when the path is taken.</p>
        <p>
          Operators: assign <code>=</code>, add <code>+</code>, subtract{' '}
          <code>-</code>, multiply <code>*</code>, divide <code>/</code>.
        </p>
        <p>
          It runs as the path is crossed, before the arriving event is read — so a
          notification or expression on the way in sees the new value.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.INPUT]: {
    title: 'An input',
    body: (
      <>
        <p>
          A single text field on an Input event. What the player types is stored
          into the variable you choose.
        </p>
        <p>
          Use that variable afterwards in conditions, effects or a{' '}
          <code>{'{ }'}</code> expression.
        </p>
      </>
    )
  },
  [ELEMENT_TYPE.JUMP]: {
    title: 'A jump',
    body: (
      <>
        <p>
          Sends play to another place in the storyworld — a scene, or a specific
          event within one.
        </p>
        <ul>
          <li>
            It is the only element that crosses a scene boundary. The world&apos;s
            opening jump decides where play begins.
          </li>
          <li>A jump with no destination is dangling and leads nowhere.</li>
        </ul>
      </>
    )
  },
  [ELEMENT_TYPE.PATH]: {
    title: 'A path',
    body: (
      <>
        <p>
          Joins two events inside one scene — the line the player follows from one
          to the next.
        </p>
        <ul>
          <li>
            <strong>Conditions</strong> gate whether it is offered.
          </li>
          <li>
            <strong>Effects</strong> change variables when it is taken.
          </li>
          <li>
            <strong>Notification</strong> — one line said in the stream as the path
            is crossed, read above the arriving event&apos;s prose.
          </li>
        </ul>
      </>
    )
  },
  [ELEMENT_TYPE.CHARACTER]: {
    title: 'A character',
    body: (
      <>
        <p>A person in the storyworld.</p>
        <ul>
          <li>
            <strong>Masks</strong> are images for different moods or appearances —
            right-click a mask tile to set its image.
          </li>
          <li>
            Reference a character in prose with <code>/</code> → Character
            Reference.
          </li>
          <li>
            <strong>Relationships</strong> are editor-only notes; only a linked
            variable reaches play.
          </li>
        </ul>
      </>
    )
  },
  EXPORT_JSON: {
    title: 'Export JSON',
    body: (
      <>
        <p>
          Exports the whole storyworld as a <code>.json</code> file, with an{' '}
          <code>assets</code> folder beside it holding its images and audio.
        </p>
        <p>
          The file can be re-imported here — it comes back named{' '}
          <code>&lt;title&gt; (Imported)</code>.
        </p>
      </>
    )
  },
  EXPORT_PWA: {
    title: 'Export PWA',
    body: (
      <>
        <p>
          Exports a self-contained, playable web app — a Progressive Web App — as
          a folder you can host anywhere.
        </p>
        <p>
          It plays the storyworld in a browser and saves the player&apos;s
          progress on its own, so they can leave and continue.
        </p>
      </>
    )
  },
  IMPORT: {
    title: 'Importing a storyworld',
    body: (
      <>
        <p>
          Imports a storyworld from a <code>.json</code> file exported by Elm
          Story. Older versions are upgraded automatically on import.
        </p>
        <p>
          Assets are copied from an <code>assets</code> folder beside the chosen
          file, so import through the dashboard&apos;s picker rather than dragging
          the JSON in alone.
        </p>
      </>
    )
  }
}
