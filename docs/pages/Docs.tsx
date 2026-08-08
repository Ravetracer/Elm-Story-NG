import React from 'react'
import { NavLink, useParams } from 'react-router-dom'

import {
  HELP_CONTENT,
  HELP_GROUPS,
  HelpTopic,
  helpTopicTitle
} from '../../src/components/ElementHelp/content'

import Expressions from './Expressions'

// The first topic is the default landing entry when no topic is in the URL.
const DEFAULT_TOPIC = HELP_GROUPS[0].topics[0]

const Docs: React.FC = () => {
  const { topic } = useParams<{ topic?: string }>()
  const active = (topic as HelpTopic) || DEFAULT_TOPIC

  const entry = HELP_CONTENT[active]

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        {HELP_GROUPS.map((group) => (
          <div className="docs-group" key={group.label}>
            <h4>{group.label}</h4>
            <ul>
              {group.topics.map((t) => (
                <li key={t}>
                  <NavLink
                    to={`/docs/${t}`}
                    className={t === active ? 'active' : ''}
                    isActive={() => t === active}
                  >
                    {helpTopicTitle(t)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      <div className="docs-content">
        <article className="prose">
          <h1>{helpTopicTitle(active)}</h1>

          {active === 'EXPRESSIONS' ? (
            <Expressions />
          ) : entry ? (
            entry.body
          ) : (
            <p>
              This topic has no page yet. Pick another from the list, or see the{' '}
              <NavLink to="/tutorial">tutorial</NavLink>.
            </p>
          )}
        </article>
      </div>
    </div>
  )
}

export default Docs
