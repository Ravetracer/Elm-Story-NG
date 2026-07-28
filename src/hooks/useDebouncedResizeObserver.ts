import { useState, useMemo } from 'react'
// lodash-es has no default export, so this is a named import rather than the
// namespace-style `import _ from 'lodash-es'` it used to be.
import { debounce } from 'lodash-es'

import useResizeObserver from 'use-resize-observer'

const useDebouncedResizeObserver = (wait: number) => {
  const [size, setSize] = useState<{
      width: number | undefined
      height: number | undefined
    }>({ width: undefined, height: undefined }),
    onResize = useMemo(() => debounce(setSize, wait, { leading: true }), [
      wait
    ]),
    { ref } = useResizeObserver({ onResize })

  return { ref, width: size.width || 0, height: size.height || 0 }
}

export default useDebouncedResizeObserver
