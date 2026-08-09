import React from 'react'
import { Link } from 'react-router-dom'

import { EDITOR_URL } from '../config'
import { ArrowRightIcon } from '../icons'

// Every screenshot below is the bundled demo storyworld — "The Jade Idol of
// K'aal" — captured from the running editor. Load it from the dashboard
// ("New here? Load the demo storyworld") and follow along in the real app.
import imgDashboard from '../assets/walkthrough/dashboard.png'
import imgComposer from '../assets/walkthrough/composer-anatomy.png'
import imgSceneMap from '../assets/walkthrough/scene-map-branching.png'
import imgMasks from '../assets/walkthrough/character-masks.png'
import imgVariables from '../assets/walkthrough/variables.png'
import imgConditions from '../assets/walkthrough/path-conditions-effects.png'
import imgObjects from '../assets/walkthrough/objects.png'
import imgPlacement from '../assets/walkthrough/placement-gate.png'
import imgRecipe from '../assets/walkthrough/recipe.png'
import imgPlayDialog from '../assets/walkthrough/play-dialog.png'
import imgPlayRail from '../assets/walkthrough/play-object-rail.png'
import imgPlayCombine from '../assets/walkthrough/play-combine.png'
import imgPlayTemplate from '../assets/walkthrough/play-template.png'
import imgPlayEnding from '../assets/walkthrough/play-ending.png'

const Figure: React.FC<{
  src: string
  alt: string
  caption: React.ReactNode
  narrow?: boolean
}> = ({ src, alt, caption, narrow }) => (
  <figure className={`wt-fig${narrow ? ' narrow' : ''}`}>
    <img src={src} alt={alt} loading="lazy" />
    <figcaption>{caption}</figcaption>
  </figure>
)

/**
 * A hands-on walkthrough that builds the whole mental model of the editor around
 * one small, complete storyworld — the bundled demo. It is deliberately the same
 * world the "Load the demo storyworld" button creates, so every screenshot can be
 * reproduced click-for-click.
 */
const Walkthrough: React.FC = () => (
  <main>
    <div className="page-head container">
      <h1 className="neon-text">Walkthrough: The Jade Idol of K&rsquo;aal</h1>
      <p>
        One small, complete adventure that uses every core mechanic once &mdash;
        branching, characters and masks, variables, conditions and effects, an
        inventory with a combine recipe, inline choices and two endings. Load it in
        the editor and read along; every screenshot below is this exact storyworld.
      </p>
      <p style={{ marginTop: 20 }}>
        <a className="btn btn-primary" href={EDITOR_URL}>
          Open the Editor <ArrowRightIcon />
        </a>
      </p>
    </div>

    <div className="container" style={{ maxWidth: 900, paddingBottom: 80 }}>
      <div className="callout">
        <strong>Play it first.</strong> On the dashboard, click{' '}
        <em>&ldquo;New here? Load the demo storyworld&rdquo;</em>. It creates a{' '}
        <em>Demo</em> studio containing this world &mdash; art and all &mdash;
        without touching your own libraries. Open it, hit <em>Preview</em>, and give
        it a play before you take it apart.
      </div>

      <div className="prose" style={{ maxWidth: 'none' }}>
        {/* 1 */}
        <div className="step" data-step="1">
          <h3>Load the demo</h3>
          <p>
            A <strong>studio</strong> is a library of storyworlds; a{' '}
            <strong>storyworld</strong> is one branching story. The demo button
            builds both for you, so you have something real to explore before you
            start from a blank canvas.
          </p>
          <Figure
            src={imgDashboard}
            alt="The dashboard with the Load the demo storyworld button"
            caption={
              <>
                The dashboard. <strong>&ldquo;Load the demo storyworld&rdquo;</strong>{' '}
                seeds the <em>Demo</em> studio and opens the card for{' '}
                <em>The Jade Idol of K&rsquo;aal</em>. Click the card to enter the
                Composer.
              </>
            }
          />
        </div>

        {/* 2 */}
        <div className="step" data-step="2">
          <h3>Anatomy of the Composer</h3>
          <p>
            The Composer is where a storyworld is built. Four regions do all the
            work &mdash; learn to read them and the rest follows.
          </p>
          <figure className="wt-fig annotated">
            <img
              src={imgComposer}
              alt="The Composer with its panes numbered"
              loading="lazy"
            />
            <span className="wt-marker" style={{ left: '8%', top: '20%' }}>
              1
            </span>
            <span className="wt-marker" style={{ left: '46%', top: '9%' }}>
              2
            </span>
            <span className="wt-marker" style={{ left: '55%', top: '30%' }}>
              3
            </span>
            <span className="wt-marker" style={{ left: '92%', top: '42%' }}>
              4
            </span>
            <span className="wt-marker" style={{ left: '10%', top: '63%' }}>
              5
            </span>
          </figure>
          <ul className="wt-legend">
            <li>
              <span className="n">1</span>
              <span>
                <strong>Storyworld outline</strong> &mdash; scenes and, nested under
                them, their events and jumps. Click a scene to open its map.
              </span>
            </li>
            <li>
              <span className="n">2</span>
              <span>
                <strong>Scene toolbar</strong> &mdash; add an event or a jump, and
                auto-arrange the map.
              </span>
            </li>
            <li>
              <span className="n">3</span>
              <span>
                <strong>Scene map</strong> &mdash; the events of one scene and the
                paths between them.
              </span>
            </li>
            <li>
              <span className="n">4</span>
              <span>
                <strong>Inspector</strong> &mdash; properties of whatever is
                selected: a scene, an event, or a path.
              </span>
            </li>
            <li>
              <span className="n">5</span>
              <span>
                <strong>Characters &amp; Variables</strong> &mdash; the two lists
                that outlive any single scene.
              </span>
            </li>
          </ul>
        </div>

        {/* 3 */}
        <div className="step" data-step="3">
          <h3>Scenes, events and branching</h3>
          <p>
            A storyworld is a set of <strong>scenes</strong>; each scene is a graph
            of <strong>events</strong>. A <strong>choice</strong> on an event leads
            along a <strong>path</strong> to another event, and a{' '}
            <strong>jump</strong> is the one thing that crosses from one scene into
            another. Here is the demo&rsquo;s labyrinth: a fork, a pair of carved
            doorways, a dead-end that loops back, and a losing ending if the torch
            burns out.
          </p>
          <Figure
            src={imgSceneMap}
            alt="The Labyrinth scene map"
            caption={
              <>
                The <em>Labyrinth</em> scene. Notice the two{' '}
                <strong>inline choices</strong> written into the prose of{' '}
                <em>A Fork in the Dark</em>, the <code>{'{ torchFuel }'}</code>{' '}
                expression, and the <em>Lost in the Dark</em> ending node (the red
                dot marks an ending). See{' '}
                <Link to="/docs/SCENE_MAP">the scene map</Link> and{' '}
                <Link to="/docs/PATH">paths</Link>.
              </>
            }
          />
        </div>

        {/* 4 */}
        <div className="step" data-step="4">
          <h3>Characters and masks</h3>
          <p>
            A <strong>character</strong> can speak an event. Give them a name and a{' '}
            <strong>mask</strong> &mdash; a portrait pinned to a mood &mdash; then
            set an event&rsquo;s <em>persona</em> to that character and mask. The
            engine draws the portrait beside the line.
          </p>
          <div className="wt-grid">
            <Figure
              src={imgMasks}
              alt="The character mask grid"
              caption={
                <>
                  Dr. Vargas&rsquo;s masks. The portrait is pinned to{' '}
                  <strong>Excited</strong>; other moods can carry their own. See{' '}
                  <Link to="/docs/CHARACTER">characters</Link>.
                </>
              }
            />
            <Figure
              src={imgPlayDialog}
              alt="The opening call, played"
              caption={
                <>
                  The same character speaking in <em>Preview</em>. Her line, her
                  portrait, an <strong>inline choice</strong> woven into the sentence
                  (&ldquo;accept the expedition&rdquo;) and a plain{' '}
                  <strong>list choice</strong> below it.
                </>
              }
            />
          </div>
        </div>

        {/* 5 */}
        <div className="step" data-step="5">
          <h3>Inline choices vs. list choices</h3>
          <p>
            A <strong>list choice</strong> sits in the list beneath the prose. An{' '}
            <strong>inline choice</strong> is a link inside a sentence &mdash; type{' '}
            <code>/</code> in the content editor and pick <em>Inline Choice</em>.
            Both lead along paths in exactly the same way; the difference is only how
            the reader meets them. The demo uses inline choices for the labyrinth
            directions and a list choice for &ldquo;Ask about the grant&rdquo;.
          </p>
        </div>

        {/* 6 */}
        <div className="step" data-step="6">
          <h3>Variables &mdash; the story&rsquo;s memory</h3>
          <p>
            Variables hold what the player has done. The demo tracks a few:{' '}
            <code>funds</code> and <code>clues</code> (numbers), and booleans like{' '}
            <code>metGuide</code>, <code>torchLit</code> and <code>idolTaken</code>.
          </p>
          <Figure
            narrow
            src={imgVariables}
            alt="The Variables list"
            caption={
              <>
                The Variables tab. Each row carries a type and a description.{' '}
                <strong>Expressions find a variable by its title</strong>, so
                renaming one silently breaks any prose that used the old name &mdash;
                the manager shows each variable&rsquo;s usage for exactly this reason.
              </>
            }
          />
        </div>

        {/* 7 */}
        <div className="step" data-step="7">
          <h3>Conditions, effects and notifications</h3>
          <p>
            Select a path to open its properties. A <strong>condition</strong> gates
            whether the path is available; an <strong>effect</strong> changes a
            variable as the path is taken; a <strong>notification</strong> is a line
            said in the stream as the player crosses it. In the demo, a wrong turn is
            open only while <code>torchFuel &gt; 1</code>, subtracts one from it, and
            says so.
          </p>
          <Figure
            narrow
            src={imgConditions}
            alt="Path properties: conditions, effects and a notification"
            caption={
              <>
                A path&rsquo;s inspector: a <strong>condition</strong> (
                <code>torchFuel &le; 1</code>), an <strong>effect</strong> (
                <code>torchFuel &minus; 1</code>), and the{' '}
                <strong>notification</strong> field. See{' '}
                <Link to="/docs/CONDITION">conditions</Link> and{' '}
                <Link to="/docs/EFFECT">effects</Link>.
              </>
            }
          />
        </div>

        {/* 8 */}
        <div className="step" data-step="8">
          <h3>Objects and the inventory</h3>
          <p>
            An <strong>object</strong> can be looked at, carried and combined. Open
            the object manager from the storyworld outline&rsquo;s toolbar. The demo
            has five: a torch, a flint striker, the lit torch they make, an ancient
            codex and the jade idol itself.
          </p>
          <div className="wt-grid">
            <Figure
              src={imgObjects}
              alt="The object manager"
              caption={<>The five objects, each with its own art and flags.</>}
            />
            <Figure
              src={imgPlayRail}
              alt="The object rail in play"
              caption={
                <>
                  In <em>Preview</em>, objects in the current scene show under{' '}
                  <strong>Here</strong> and carried ones under{' '}
                  <strong>Inventory</strong>. Click a tile for its verbs (Look at,
                  Take, Combine).
                </>
              }
            />
          </div>
        </div>

        {/* 9 */}
        <div className="step" data-step="9">
          <h3>Placements &mdash; and gating them</h3>
          <p>
            A <strong>placement</strong> says where an object starts and how many.
            Gate it on a variable or another object and it appears only when the gate
            turns true. The flint in the market is hidden until you talk to the guide.
          </p>
          <Figure
            src={imgPlacement}
            alt="A gated placement"
            caption={
              <>
                The flint&rsquo;s placement in <em>The Market</em>, gated on{' '}
                <code>metGuide = true</code>. Below it: a <em>take</em> message and
                the recipe that consumes it.
              </>
            }
          />
        </div>

        {/* 10 */}
        <div className="step" data-step="10">
          <h3>Recipes &mdash; combining objects</h3>
          <p>
            A <strong>recipe</strong> turns objects into another object. One input is
            a <em>Use</em>; two is a <em>Combine</em>. The demo&rsquo;s single recipe
            turns the torch and the flint into a lit torch &mdash; and only a lit
            torch opens the path into the labyrinth.
          </p>
          <div className="wt-grid">
            <Figure
              src={imgRecipe}
              alt="The recipe editor"
              caption={
                <>
                  <strong>Torch + Flint &amp; Steel &rarr; Lit Torch</strong>, output
                  to the inventory, with a success message.
                </>
              }
            />
            <Figure
              src={imgPlayCombine}
              alt="Combining in play"
              caption={
                <>
                  Combined in <em>Preview</em>: the recipe&rsquo;s message prints, the
                  lit torch enters the inventory, and the previously-closed{' '}
                  <em>&ldquo;Step into the labyrinth&rdquo;</em> choice opens &mdash;
                  it was gated on carrying a lit torch.
                </>
              }
            />
          </div>
        </div>

        {/* 11 */}
        <div className="step" data-step="11">
          <h3>Template expressions in prose</h3>
          <p>
            Type <code>{'{'}</code> in event content to write a template expression.
            It is resolved against the state the player arrives with &mdash; print a
            value, do arithmetic, or choose between two texts.
          </p>
          <Figure
            src={imgPlayTemplate}
            alt="A template expression resolved in play"
            caption={
              <>
                <code>{'{ torchFuel }'}</code> renders as the live value &mdash;{' '}
                <em>&ldquo;3 breaths of flame&rdquo;</em> &mdash; and the two
                directions are inline choices. The full language is on the{' '}
                <Link to="/docs/EXPRESSIONS">expressions</Link> page.
              </>
            }
          />
        </div>

        {/* 12 */}
        <div className="step" data-step="12">
          <h3>Endings</h3>
          <p>
            An event marked as an <strong>ending</strong> stops the story. The demo
            has two: <em>Lost in the Dark</em> if the torch gutters out, and the
            museum if you bring the idol home. Taking the idol sets{' '}
            <code>idolTaken</code>, which is what opens the way back.
          </p>
          <Figure
            src={imgPlayEnding}
            alt="The winning ending"
            caption={
              <>
                The winning ending. The take-message prints, Dr. Vargas closes the
                story, and <code>{'{ funds }'}</code> reports the grant money left
                over. <em>Restart</em> plays again from the top.
              </>
            }
          />
        </div>

        <hr />

        <h3>Where to go next</h3>
        <p>
          You have now seen every core mechanic in one story. Open the demo in the
          editor and change something &mdash; a condition, a line of prose, a
          placement gate &mdash; then hit <em>Preview</em> and watch it play
          differently. When you are ready to ship, the{' '}
          <Link to="/docs/EXPORT_PWA">export</Link> menu packs your storyworld as an
          installable web app. For a shorter, screenshot-free tour of the same loop,
          see the <Link to="/tutorial">quick tutorial</Link>; for the reference on
          any single piece, browse the <Link to="/docs">documentation</Link>.
        </p>
      </div>
    </div>
  </main>
)

export default Walkthrough
