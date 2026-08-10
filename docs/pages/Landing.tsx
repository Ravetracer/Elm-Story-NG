import React from 'react'
import { Link } from 'react-router-dom'

import { EDITOR_URL, REPO_URL } from '../config'
import {
  ArrowRightIcon,
  BookIcon,
  BracesIcon,
  CubeIcon,
  ExportIcon,
  GithubIcon,
  GlobeIcon,
  HeartIcon,
  MapIcon,
  PaletteIcon,
  UsersIcon
} from '../icons'

// The outlined "Elm Story - NG" wordmark (glyphs are outlines, safe to ship),
// imported as a URL asset Vite bundles locally.
import wordmarkUrl from '../../src/components/Modal/ESGModal/banner.svg'

// A real shot of the composer for the "what it is" panel — the same full-window
// capture the walkthrough annotates, shown here unannotated inside the neon frame.
import composerUrl from '../assets/walkthrough/composer-anatomy.png'

const FEATURES = [
  {
    Icon: MapIcon,
    title: 'A visual scene map',
    body: 'Lay out events, choices and jumps as a graph. Drag to arrange, auto-layout a tangle, and follow every branch at a glance.'
  },
  {
    Icon: BracesIcon,
    title: 'Template expressions',
    body: 'Weave state into prose with { health > 50 ? "Steady." : "Hurt." } — values, conditions, method calls and arithmetic, right in the text.'
  },
  {
    Icon: UsersIcon,
    title: 'Characters & variables',
    body: 'Give events a speaker, track state in typed variables, and gate paths with conditions and effects that change as the story is played.'
  },
  {
    Icon: CubeIcon,
    title: 'Objects & recipes',
    body: 'Hand the player an inventory: place objects in the world, let them take and combine pairs, and reveal content as things change.'
  },
  {
    Icon: PaletteIcon,
    title: 'Presentation you control',
    body: 'Per-storyworld colours, fonts, transitions, a cover and a background — plus translatable interface text for every word the player reads.'
  },
  {
    Icon: ExportIcon,
    title: 'Export anywhere',
    body: 'Ship a self-contained, installable PWA, a portable ZIP bundle with all its media, or plain JSON. No account, no server, no lock-in.'
  },
  {
    Icon: GlobeIcon,
    title: 'Runs in the browser',
    body: 'Write with nothing to install — the whole editor runs in a tab and saves locally — or use the desktop app for durable storage.'
  },
  {
    Icon: HeartIcon,
    title: 'Free & open source',
    body: 'GPL-3.0. Read it, fork it, self-host it. The source and every release live on GitHub.'
  }
]

const Landing: React.FC = () => (
  <main>
    <section className="hero">
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      <div className="container hero-inner">
        <span className="eyebrow">Interactive fiction, made visual</span>

        <img className="hero-wordmark" src={wordmarkUrl} alt="Elm Story - NG" />

        <h1 className="neon-text">Write branching storyworlds</h1>

        <p className="lead">
          Elm Story - NG is a visual editor for interactive, branching narrative.
          Map out scenes and choices, weave in state and characters, preview as you
          write, and export a story that plays in any browser.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary" href={EDITOR_URL}>
            Open the Editor <ArrowRightIcon />
          </a>
          <Link className="btn btn-secondary" to="/tutorial">
            <BookIcon /> Start the tutorial
          </Link>
          <a
            className="btn btn-secondary"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubIcon /> Get the source
          </a>
        </div>
      </div>
    </section>

    <section className="section" id="what">
      <div className="container split">
        <div>
          <span className="eyebrow">What it is</span>
          <h2>Everything a story needs, nothing it doesn&apos;t</h2>
          <p>
            A storyworld is scenes of events joined by choices. Around that spine
            Elm Story - NG gives you variables, characters, objects and conditional
            paths — the machinery of a branching story — with an in-editor player so
            you always see what the reader will.
          </p>
          <ul className="checks">
            <li>
              <ArrowRightIcon />
              <span>
                A dockable composer: storyworld outline, scene map and an inspector
                for whatever you select.
              </span>
            </li>
            <li>
              <ArrowRightIcon />
              <span>
                A live preview that plays the real engine — the same one your export
                ships.
              </span>
            </li>
            <li>
              <ArrowRightIcon />
              <span>
                Autosave, one-bookmark resume, and import/export that round-trips
                between the web and desktop builds.
              </span>
            </li>
          </ul>
        </div>

        <div className="mock">
          <img
            className="mock-shot"
            src={composerUrl}
            alt="The Elm Story - NG composer: the storyworld outline, the scene map and the inspector"
            loading="lazy"
          />
        </div>
      </div>
    </section>

    <section className="section alt" id="features">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">The toolkit</span>
          <h2>Built for branching narrative</h2>
          <p>
            Each piece is authorable in the editor and playable in the export — no
            code required, though there is real logic under the hood when you want
            it.
          </p>
        </div>

        <div className="feature-grid">
          {FEATURES.map(({ Icon, title, body }) => (
            <div className="feature-card" key={title}>
              <Icon className="ficon" />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="cta-band" id="start">
      <div className="container">
        <h2 className="neon-text">Start your first storyworld</h2>
        <p>
          Open the editor and write, or follow the step-by-step tutorial through the
          core mechanics — creating a world, branching it, and giving it state.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href={EDITOR_URL}>
            Open the Editor <ArrowRightIcon />
          </a>
          <Link className="btn btn-secondary" to="/docs">
            <BookIcon /> Read the docs
          </Link>
        </div>
      </div>
    </section>
  </main>
)

export default Landing
