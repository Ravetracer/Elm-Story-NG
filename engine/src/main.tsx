import { render } from 'react-dom'

import ServiceWorker from './components/ServiceWorker'
import Runtime from './Runtime'

function main() {
  const ___worldId: string = '___worldId___',
    ___packedStoryworldData: string = '___storytellerData___'

  // No URL: the elmstory.com this used to print no longer resolves, and an
  // exported storyworld is the one place this string is read by someone who is
  // not the author.
  console.info(
    `[STORYTELLER] made with Elm Story - NG ${String.fromCodePoint(
      0x1f4da
    )} 0.7.1`
  )

  const rendererContainer = document.getElementById('runtime') || document.body

  if (!import.meta.env.DEV) {
    render(
      <>
        <ServiceWorker />
        <Runtime
          world={{
            id: ___worldId,
            data: ___packedStoryworldData,
            packed: true
          }}
        />
      </>,
      rendererContainer
    )
  }

  if (import.meta.env.DEV) {
    import('../data/0-7-test/0-7-test.json').then((data) =>
      render(
        <>
          <ServiceWorker />
          <Runtime
            world={{
              id: data._.id,
              data: JSON.stringify(data),
              packed: false
            }}
          />
        </>,
        rendererContainer
      )
    )
  }
}

// Invoked here rather than from an inline module script in index.html so the
// build produces exactly one entry chunk. The editor's PWA export locates that
// chunk via manifest['index.html'].file and string-replaces the placeholder
// tokens above inside it, so the tokens and the entry must live in one file.
main()

export default main
