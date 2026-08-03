import React, { memo, useRef, useState, useEffect, HTMLAttributes } from 'react'

import { Rect } from 'react-flow-renderer'

import { ElementId, PATH_CONDITIONS_TYPE } from '../../../data/types'

export interface PathEdgeLabelProps extends HTMLAttributes<SVGElement> {
  x: number
  y: number
  pathId?: ElementId
  totalConditions: number
  totalEffects: number
  conditionsType: PATH_CONDITIONS_TYPE
  notification?: string
}

import styles from './styles.module.less'

const PathEdgeLabel: React.FC<PathEdgeLabelProps> = ({
  x,
  y,
  pathId,
  totalConditions = 0,
  totalEffects = 0,
  conditionsType,
  notification,
  children,
  ...rest
}) => {
  const rectHeight = 12,
    textSpacing = 7,
    horizontalPadding = 6,
    // the notification cell holds a dot rather than a count, so unlike the two
    // cells beside it its width is not measured from any text
    notificationWidth = 11

  // whitespace is not a line: the engine drops a notification whose resolved
  // text is blank (`getPathNotification`), so a label that marked one would
  // promise something the player never hears
  const hasNotification = !!notification?.trim()

  const conditionsTextRef = useRef<SVGTextElement>(null),
    effectsTextRef = useRef<SVGTextElement>(null)

  const [conditionsTextBbox, setConditionsTextBbox] = useState<Rect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  const [effectsTextBbox, setEffectsTextBbox] = useState<Rect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })

  const [rectBbox, setRectBbox] = useState<Rect>({
    x: 0,
    y: rectHeight / 2,
    width: 0,
    height: rectHeight
  })

  useEffect(() => {
    if (conditionsTextRef.current && effectsTextRef.current) {
      const conditionsTextBbox = conditionsTextRef.current.getBBox(),
        effectsTextBbox = effectsTextRef.current.getBBox()

      setRectBbox({
        ...rectBbox,
        x: conditionsTextBbox.x + effectsTextBbox.x,
        width:
          conditionsTextBbox.width +
          effectsTextBbox.width +
          horizontalPadding +
          textSpacing
      })

      setConditionsTextBbox({
        x: conditionsTextBbox.x,
        y: conditionsTextBbox.y,
        width: conditionsTextBbox.width,
        height: conditionsTextBbox.height
      })

      setEffectsTextBbox({
        x: effectsTextBbox.x,
        y: effectsTextBbox.y,
        width: effectsTextBbox.width,
        height: effectsTextBbox.height
      })
    }
  }, [totalConditions, totalEffects])

  // the two measured cells tile exactly to `rectBbox.width`, so the notification
  // cell begins where they end and the label grows by its width
  const labelWidth = rectBbox.width + (hasNotification ? notificationWidth : 0)

  // Unique per path, because an SVG id is document-global: every edge on the map
  // renders one of these, and a shared id had them all clipped by whichever def
  // the document resolved first — invisible while the labels were the same width,
  // and not invisible at all once one of them carries a notification cell.
  const clipPathId = `round-corner-${pathId || 'unknown'}`

  return (
    <>
      <defs>
        <clipPath id={clipPathId}>
          <rect
            x="0"
            y="0"
            width={labelWidth}
            height={rectHeight}
            rx="2"
            ry="2"
          />
        </clipPath>
      </defs>

      <g
        transform={`translate(${x - labelWidth / 2} ${y - rectHeight / 2})`}
        {...rest}
        className={styles.PathEdgeLabel}
        style={{ cursor: 'pointer' }}
        clipPath={`url(#${clipPathId})`}
      >
        {/*
          The line itself, as a native tooltip — the marker says a path speaks,
          this says what it speaks, which is what makes the right path findable
          without opening each one in turn.
        */}
        {hasNotification && <title>{notification}</title>}

        <rect
          style={{ fill: 'black' }}
          x={0}
          y={0}
          width={labelWidth}
          height={rectHeight}
        />

        <rect
          className={`${styles.conditions} ${
            totalConditions === 0 ? styles.none : ''
          } ${
            totalConditions > 0 && conditionsType === PATH_CONDITIONS_TYPE.ALL
              ? styles.all
              : ''
          } ${
            totalConditions > 0 && conditionsType === PATH_CONDITIONS_TYPE.ANY
              ? styles.any
              : ''
          }`}
          width={
            horizontalPadding / 2 + conditionsTextBbox.width + textSpacing / 2
          }
          height={rectHeight}
          x={0}
          y={0}
        />

        <text
          x={horizontalPadding / 2}
          y={conditionsTextBbox.height / 2}
          dy="0.3em"
          ref={conditionsTextRef}
          className={styles.label}
        >
          {totalConditions === 0 ? '-' : `${totalConditions}`}
        </text>

        <rect
          className={`${styles.effects} ${
            totalEffects === 0 ? styles.none : ''
          }`}
          width={
            horizontalPadding / 2 + effectsTextBbox.width + textSpacing / 2
          }
          height={rectHeight}
          x={horizontalPadding / 2 + conditionsTextBbox.width + textSpacing / 2}
          y={0}
        />

        <text
          x={horizontalPadding / 2 + conditionsTextBbox.width + textSpacing}
          y={effectsTextBbox.height / 2}
          dy="0.3em"
          ref={effectsTextRef}
          className={styles.label}
        >
          {totalEffects === 0 ? '-' : `${totalEffects}`}
        </text>

        <rect
          width={1}
          height={rectHeight}
          className={styles.divider}
          x={
            horizontalPadding / 2 +
            conditionsTextBbox.width -
            0.5 +
            textSpacing / 2
          }
        />

        {/*
          NOTIFICATION

          A cell that exists only when there is a line to say, rather than a
          third count that reads '-' on the majority of paths: this one is an
          overview marker, and one that is present on every edge marks nothing.
          It carries a dot instead of a number because there is only ever one
          notification per path — and because a shape, not a colour, is what
          tells it apart from the two counts beside it.
        */}
        {hasNotification && (
          <>
            <rect
              className={styles.notification}
              width={notificationWidth}
              height={rectHeight}
              x={rectBbox.width}
              y={0}
            />

            <circle
              className={styles.notificationDot}
              cx={rectBbox.width + notificationWidth / 2}
              cy={rectHeight / 2}
              r={2.5}
            />

            <rect
              width={1}
              height={rectHeight}
              className={styles.divider}
              x={rectBbox.width - 0.5}
            />
          </>
        )}

        {children}
      </g>
    </>
  )
}

PathEdgeLabel.displayName = 'PathEdgeLabel'

export default memo(PathEdgeLabel)
