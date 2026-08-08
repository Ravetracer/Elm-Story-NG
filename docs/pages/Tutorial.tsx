import React from 'react'
import { Link } from 'react-router-dom'

import { EDITOR_URL } from '../config'
import { ArrowRightIcon } from '../icons'

/**
 * A hands-on walk through the core loop of building a storyworld. Written against
 * the real editor UI; when a mechanic has a full reference, it links into /docs.
 */
const Tutorial: React.FC = () => (
  <main>
    <div className="page-head container">
      <h1 className="neon-text">Build your first storyworld</h1>
      <p>
        A guided tour of the core mechanics — from an empty studio to an exported
        story you can share. Open the editor in another tab and follow along.
      </p>
      <p style={{ marginTop: 20 }}>
        <a className="btn btn-primary" href={EDITOR_URL}>
          Open the Editor <ArrowRightIcon />
        </a>
      </p>
    </div>

    <div className="container" style={{ maxWidth: 820, paddingBottom: 80 }}>
      <div className="prose">
        <div className="step" data-step="1">
          <h3>Create a studio and a storyworld</h3>
          <p>
            A <strong>studio</strong> is the library your storyworlds live in. On
            the dashboard, open <em>Select studio…</em> and{' '}
            <em>Create Studio…</em>, give it a name, then <em>create</em> a
            storyworld inside it — a title and a designer name are all it needs.
            Click the storyworld to open the <strong>Composer</strong>.
          </p>
        </div>

        <div className="step" data-step="2">
          <h3>Add a scene and some events</h3>
          <p>
            The Composer has three panes: the <strong>storyworld outline</strong> on
            the left, the <strong>scene map</strong> in the middle, and the{' '}
            <strong>inspector</strong> on the right. A storyworld is scenes; a scene
            is a graph of <strong>events</strong>.
          </p>
          <ul>
            <li>
              Open a scene from the outline to see its map, then use the{' '}
              <strong>+ Event</strong> button on the map toolbar to add events.
            </li>
            <li>
              Click an event to edit its prose in the content editor. Type{' '}
              <code>/</code> for a command menu (headings, images, a character
              reference, an inline choice) and <code>{'{'}</code> to start a
              template expression.
            </li>
          </ul>
          <p>
            See <Link to="/docs/SCENE_MAP">the scene map</Link> and{' '}
            <Link to="/docs/EVENT">events</Link> for the full reference.
          </p>
        </div>

        <div className="step" data-step="3">
          <h3>Branch it with choices and paths</h3>
          <p>
            A <strong>choice</strong> is an option the player picks; a{' '}
            <strong>path</strong> is the connection it leads along. Add a choice to
            an event, then drag from the choice&apos;s handle to another event to
            draw the path. An event with no choices ends the story or passes
            straight through.
          </p>
          <p>
            Reference: <Link to="/docs/CHOICE">choices</Link> and{' '}
            <Link to="/docs/PATH">paths</Link>.
          </p>
        </div>

        <div className="step" data-step="4">
          <h3>Give an event a speaker</h3>
          <p>
            Create a <strong>character</strong> from the panel under the outline,
            give them a name and a mask (portrait), then set an event&apos;s{' '}
            <em>persona</em> to have them speak it. You can also drop a character
            reference into prose with <code>/</code>, so a name updates everywhere at
            once.
          </p>
          <p>
            Reference: <Link to="/docs/CHARACTER">characters</Link>.
          </p>
        </div>

        <div className="step" data-step="5">
          <h3>Track state with variables</h3>
          <p>
            Open the <strong>Variables</strong> tab in the inspector and add one —
            say a Number <code>health</code> or a Boolean <code>metGuard</code>.
            Variables hold the story&apos;s memory: what the player has done, chosen
            or typed.
          </p>
          <div className="callout">
            <strong>Names matter.</strong> Expressions find a variable by its{' '}
            <em>title</em>, so renaming one breaks the text that used the old name —
            silently. The manager shows each variable&apos;s usage; check it before
            renaming.
          </div>
        </div>

        <div className="step" data-step="6">
          <h3>Make paths conditional</h3>
          <p>
            Select a path and add a <strong>condition</strong> — “open only when{' '}
            <code>health &gt; 0</code>” — so a choice leads somewhere only when the
            state allows. Add an <strong>effect</strong> to change state as the path
            is taken: subtract from <code>health</code>, set <code>metGuard</code> to
            true. Together, conditions and effects turn a branching tree into a
            system.
          </p>
          <p>
            Reference: <Link to="/docs/CONDITION">conditions</Link> and{' '}
            <Link to="/docs/EFFECT">effects</Link>.
          </p>
        </div>

        <div className="step" data-step="7">
          <h3>Weave state into the prose</h3>
          <p>
            In event content, type <code>{'{'}</code> to write a template
            expression. Print a value, choose between two texts, call a method, or do
            arithmetic — all resolved against the state the player arrives with:
          </p>
          <div className="example">
            <code>{'{ health > 50 ? "You feel strong." : "You are hurting." }'}</code>
          </div>
          <p>
            The full language — every operator and form — is on the{' '}
            <Link to="/docs/EXPRESSIONS">variables &amp; expressions</Link> page.
          </p>
        </div>

        <div className="step" data-step="8">
          <h3>Preview as you write</h3>
          <p>
            The <strong>Preview</strong> pane plays your storyworld with the real
            engine — the same one your export ships — so what you see is what the
            reader gets. Use <em>Reset</em> to start over from the opening jump.
            Playthroughs autosave, so closing and reopening resumes where you left
            off.
          </p>
        </div>

        <div className="step" data-step="9">
          <h3>Export and share</h3>
          <p>
            From the outline&apos;s export menu, choose a format:
          </p>
          <ul>
            <li>
              <strong>PWA</strong> — a self-contained, installable web app of your
              finished story.
            </li>
            <li>
              <strong>ZIP</strong> — a portable bundle (the data plus all its media)
              that re-imports into either the web or desktop build.
            </li>
            <li>
              <strong>JSON</strong> — the structure alone, for backups or version
              control.
            </li>
          </ul>
          <p>
            Reference: <Link to="/docs/EXPORT_PWA">exporting</Link> and{' '}
            <Link to="/docs/IMPORT">importing</Link>.
          </p>
        </div>

        <hr />

        <p>
          That is the whole loop: scenes and events, choices and paths, characters,
          variables, conditions, effects and expressions — previewed live and
          exported to play anywhere. Browse the{' '}
          <Link to="/docs">documentation</Link> for the details of any piece.
        </p>
      </div>
    </div>
  </main>
)

export default Tutorial
