import React from 'react'

import { animated } from 'react-spring'

const AcceleratedDiv = React.forwardRef<
  HTMLDivElement,
  { style?: {}; className?: string; children?: React.ReactNode }
>(({ style, className, children }, ref) => {
  return (
    <animated.div
      // translate3d(0,0,0) forces GPU compositing and is the default; a caller
      // may override transform (the SLIDE transition animates translateY here),
      // so the spread comes last and its transform wins.
      style={{ transform: 'translate3d(0,0,0)', ...style }}
      className={className}
      ref={ref}
    >
      {children}
    </animated.div>
  )
})

AcceleratedDiv.displayName = 'AcceleratedDiv'

export default AcceleratedDiv
