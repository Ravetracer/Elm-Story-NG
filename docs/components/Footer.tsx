import React from 'react'
import { Link } from 'react-router-dom'

import { EDITOR_URL, LICENSE, REPO_URL } from '../config'
import { GithubIcon } from '../icons'

const Footer: React.FC = () => (
  <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-brand">
        <div className="brand">
          <span className="neon-text">Elm Story - NG</span>
        </div>
        <p>
          A visual editor for branching narrative storyworlds. Write once, play in
          any browser.
        </p>
        <p style={{ marginTop: 14 }}>
          <a
            className="social"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GithubIcon className="social-icon" />
          </a>
        </p>
      </div>

      <div className="footer-col">
        <h5>Project</h5>
        <ul>
          <li>
            <a href={EDITOR_URL}>Open the editor</a>
          </li>
          <li>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source on GitHub
            </a>
          </li>
          <li>
            <a
              href={`${REPO_URL}/releases`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Releases
            </a>
          </li>
        </ul>
      </div>

      <div className="footer-col">
        <h5>Learn</h5>
        <ul>
          <li>
            <Link to="/docs">Documentation</Link>
          </li>
          <li>
            <Link to="/tutorial">Tutorial</Link>
          </li>
          <li>
            <Link to="/docs/EXPRESSIONS">Variables &amp; expressions</Link>
          </li>
        </ul>
      </div>

      <div className="footer-col">
        <h5>About</h5>
        <ul>
          <li>
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
            >
              License ({LICENSE})
            </a>
          </li>
          <li>
            <a
              href={`${REPO_URL}/blob/main/CREDITS`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Credits
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div className="container">
      <div className="footer-bottom">
        <p>
          Elm Story - NG is a continuation of Elm Story, whose original authors
          (Elm Story Games LLC) stopped development at 0.7.0 in April 2022. This is
          not their work and they do not support it.
        </p>
      </div>
    </div>
  </footer>
)

export default Footer
