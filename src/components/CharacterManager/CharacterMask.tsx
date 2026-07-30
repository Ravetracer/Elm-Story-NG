import { ipcRenderer } from 'electron'

import React, { useEffect, useState } from 'react'

import {
  CHARACTER_MASK_TYPE,
  CHARACTER_MASK_VALUES,
  ElementId,
  WorldId,
  StudioId
} from '../../data/types'
import { WINDOW_EVENT_TYPE } from '../../lib/events'

import { Button, Dropdown } from 'antd'

import styles from './styles.module.less'

import api from '../../api'

const CharacterMask: React.FC<{
  studioId: StudioId
  worldId: WorldId
  characterId: ElementId
  type: CHARACTER_MASK_TYPE
  assetId?: string
  active?: boolean
  dominate?: { drive: boolean; agency: boolean }
  width?: string | number
  height?: string | number
  aspectRatio?: string
  overlay?: boolean
  contextMenu?: boolean
  fill?: boolean
  onChangeMaskImage?: (type: CHARACTER_MASK_TYPE) => void
  // assign an image the storyworld already has, rather than importing a file
  onChooseMaskImage?: (type: CHARACTER_MASK_TYPE) => void
  onReset?: (type: CHARACTER_MASK_TYPE) => void
  onToggle?: (type: CHARACTER_MASK_TYPE) => void
}> = React.memo(
  ({
    studioId,
    worldId,
    characterId,
    type,
    assetId,
    active,
    dominate,
    width,
    height,
    aspectRatio = '4/5',
    overlay,
    contextMenu,
    fill,
    onChangeMaskImage,
    onChooseMaskImage,
    onReset,
    onToggle
  }) => {
    const [maskImagePath, setMaskImagePath] = useState<string | undefined>(
      undefined
    )

    /*
     * The details menu is controlled so that picking an entry dismisses it,
     * which an antd Dropdown does for a Menu but not for a custom overlay like
     * this one. It matters beyond tidiness: a dropdown sits at z-index 1050 and
     * a modal at 1000, so a menu left open covers the asset picker that Choose
     * just opened, and the mask preview inside it is large enough to hide most
     * of it.
     */
    const [detailsVisible, setDetailsVisible] = useState(false)

    // every entry acts and then dismisses
    const runFromMenu = (action?: (type: CHARACTER_MASK_TYPE) => void) => () => {
      setDetailsVisible(false)

      action?.(type)
    }

    const mask = (
      <div
        className={`${styles.CharacterMask} ${
          dominate?.drive ? styles.dominateDrive : ''
        } ${dominate?.agency ? styles.dominateAgency : ''} ${
          contextMenu ? styles.interactive : ''
        } ${active ? styles.active : ''} ${fill ? styles.fill : ''}`}
        style={{
          width: width || 'auto',
          height: height || 'auto'
        }}
        onClick={() => onToggle && onToggle(type)}
      >
        <div
          className={`${styles.wrapper} ${active ? styles.active : ''} ${
            fill ? styles.fill : ''
          }`}
        >
          <div
            className={`${styles.mask} ${active ? styles.active : ''}`}
            style={{
              aspectRatio,
              backgroundImage: maskImagePath ? `url(${maskImagePath})` : ''
            }}
          />

          {overlay && (
            <div
              className={`${styles.overlay} ${styles.type}  ${
                active && styles.active
              }`}
            >
              {type}
            </div>
          )}
        </div>
      </div>
    )

    useEffect(() => {
      async function getMaskImagePath() {
        if (!assetId) {
          setMaskImagePath(undefined)
          return
        }

        if (assetId) {
          const [path, exists]: [string, boolean] = await ipcRenderer.invoke(
            WINDOW_EVENT_TYPE.GET_ASSET,
            {
              studioId,
              worldId,
              id: assetId,
              ext: 'jpeg'
            }
          )

          if (exists) {
            setMaskImagePath(path)
            return
          }

          if (!exists) {
            const character = await api().characters.getCharacter(
              studioId,
              characterId
            )

            if (character) {
              const newMasks = [...character.masks],
                foundMaskIndex = newMasks.findIndex(
                  (newMask) => newMask.type === type
                )

              if (foundMaskIndex !== -1) {
                newMasks[foundMaskIndex].assetId = undefined
                await api().characters.saveCharacter(studioId, {
                  ...character,
                  masks: newMasks
                })
              }
            }
          }
        }
      }

      getMaskImagePath()
    }, [assetId])

    return (
      <>
        {contextMenu && (
          <Dropdown
            disabled={!contextMenu}
            overlayClassName="mask-details-menu"
            placement="topLeft"
            overlay={
              <div className={styles.content}>
                <div className={styles.title}>
                  <h1
                    className={`${active ? styles.active : ''}`}
                    style={{
                      marginBottom:
                        type !== CHARACTER_MASK_TYPE.NEUTRAL ? 'unset' : '0'
                    }}
                  >
                    {type}
                  </h1>
                  {type !== CHARACTER_MASK_TYPE.NEUTRAL && (
                    <h2>
                      <span
                        className={`${styles.drive} ${
                          active ? styles.active : ''
                        } ${dominate?.drive ? styles.dominate : ''}`}
                      >
                        {`${CHARACTER_MASK_VALUES[type][0] > 0 ? '+' : '-'}`}
                        DRIVE
                      </span>{' '}
                      <span
                        className={`${styles.agency} ${
                          active ? styles.active : ''
                        } ${dominate?.agency ? styles.dominate : ''}`}
                      >
                        {`${CHARACTER_MASK_VALUES[type][1] > 0 ? '+' : '-'}`}
                        AGENCY
                      </span>{' '}
                      <span>|</span>{' '}
                      <span className={`${active ? styles.active : ''}`}>
                        {CHARACTER_MASK_VALUES[type][2]}X
                      </span>
                    </h2>
                  )}
                </div>

                <div
                  className={styles.maskImage}
                  style={{
                    backgroundImage: maskImagePath
                      ? `url(${maskImagePath})`
                      : ''
                  }}
                >
                  <div className={styles.buttons}>
                    <div>
                      {type !== CHARACTER_MASK_TYPE.NEUTRAL && (
                        <Button onClick={runFromMenu(onToggle)}>
                          {active ? 'Disable' : 'Enable'}
                        </Button>
                      )}

                      <Button onClick={runFromMenu(onChangeMaskImage)}>
                        Import
                      </Button>

                      {onChooseMaskImage && (
                        <Button onClick={runFromMenu(onChooseMaskImage)}>
                          Choose
                        </Button>
                      )}

                      {((active && type !== CHARACTER_MASK_TYPE.NEUTRAL) ||
                        assetId) && (
                        <Button onClick={runFromMenu(onReset)}>Reset</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            }
            trigger={['contextMenu']}
            visible={detailsVisible}
            onVisibleChange={setDetailsVisible}
          >
            {mask}
          </Dropdown>
        )}

        {!contextMenu && mask}
      </>
    )
  }
)

CharacterMask.displayName = 'CharacterMask'

export default CharacterMask
