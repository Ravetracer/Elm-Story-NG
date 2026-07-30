import { names, uniqueNamesGenerator } from 'unique-names-generator'

import React, { useState, useContext } from 'react'

import {
  CHARACTER_MASK_TYPE,
  ELEMENT_TYPE,
  World,
  StudioId
} from '../../data/types'

import {
  ComposerContext,
  COMPOSER_ACTION_TYPE
} from '../../contexts/ComposerContext'

import DockLayout, { DividerBox, LayoutData } from 'rc-dock'
import { Tooltip } from 'antd'
import {
  QuestionCircleFilled,
  UnorderedListOutlined
} from '@ant-design/icons'

import { VariablesModal } from '../Modal'
import addVariable from '../VariableManager/addVariable'
import WorldOutline from '../WorldOutline'
import WorldCharacters from '../WorldCharacters'
import WorldVariables from '../WorldVariables'
import ElementHelpButton from '../ElementHelpButton'

import api from '../../api'

import helpButtonStyles from '../ElementHelpButton/styles.module.less'
import styles from './styles.module.less'

const TAB_TYPE = {
  CHARACTERS: 'CHARACTERS',
  VARIABLES: 'VARIABLES'
}

const WorldInspector: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const { composerDispatch } = useContext(ComposerContext)

  // Read by the Variables tab title below, which is captured in defaultLayout on
  // the first render. A setter's identity is stable, so the closure stays valid.
  // `help` opens the manager onto its reference rather than onto the list.
  const [variablesModal, setVariablesModal] = useState({
    visible: false,
    help: false
  })

  const openVariablesModal = (help = false) =>
    setVariablesModal({ visible: true, help })

  const [defaultLayout] = useState<LayoutData>({
    dockbox: {
      mode: 'horizontal',
      children: [
        {
          mode: 'vertical',
          children: [
            {
              tabs: [
                {
                  id: TAB_TYPE.CHARACTERS,
                  title: (
                    <div>
                      Characters
                      {world.id && (
                        <span
                          className={styles.tabAddComponentButton}
                          onClick={async () => {
                            if (world.id) {
                              // TODO: change to lib method
                              const character = await api().characters.saveCharacter(
                                studioId,
                                {
                                  description: undefined,
                                  worldId: world.id,
                                  masks: [
                                    {
                                      type: CHARACTER_MASK_TYPE.NEUTRAL,
                                      active: true
                                    }
                                  ],
                                  refs: [],
                                  tags: [],
                                  title: uniqueNamesGenerator({
                                    dictionaries: [names, names],
                                    length: 2,
                                    separator: ' '
                                  })
                                }
                              )

                              character.id &&
                                composerDispatch({
                                  type:
                                    COMPOSER_ACTION_TYPE.OPEN_CHARACTER_MODAL,
                                  characterId: character.id
                                })
                            }
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8 4H6V8H2V10H6V14H8V10H12V8H8V4Z"
                              fill="white"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                  ),
                  minHeight: 32,
                  content: (
                    <>
                      {world.id && (
                        <WorldCharacters
                          studioId={studioId}
                          worldId={world.id}
                        />
                      )}
                    </>
                  ),
                  group: 'bottom'
                },
                {
                  id: TAB_TYPE.VARIABLES,
                  title: (
                    <div>
                      Variables
                      {world.id && (
                        <Tooltip title="Manage Variables..." mouseEnterDelay={1}>
                          <span
                            className={styles.tabManageButton}
                            onClick={() => openVariablesModal()}
                          >
                            <UnorderedListOutlined />
                          </span>
                        </Tooltip>
                      )}
                      {world.id && (
                        <span
                          className={styles.tabAddComponentButton}
                          onClick={async () => {
                            // TODO: Fire only when tab is active #92
                            if (!world.id) return

                            await addVariable(studioId, world.id)

                            // the panel is an index now, so a new variable is
                            // only nameable in the manager
                            openVariablesModal()
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M8 4H6V8H2V10H6V14H8V10H12V8H8V4Z"
                              fill="white"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                  ),
                  minHeight: 32,
                  content: (
                    <>
                      {world.id && (
                        <WorldVariables
                          studioId={studioId}
                          worldId={world.id}
                          onOpenManager={() => openVariablesModal()}
                        />
                      )}
                    </>
                  ),
                  group: 'bottom'
                }
              ],
              panelLock: {
                // @ts-ignore: poor ts defs
                panelExtra: (panelData, context) => {
                  // The variables help is in the app rather than behind a link:
                  // ElementHelpButton opens docs.elmstory.com, which no longer
                  // resolves. The remaining element types still point there.
                  if (panelData.activeId === TAB_TYPE.VARIABLES)
                    return (
                      <div
                        className={helpButtonStyles.ElementHelpButton}
                        onClick={(event) => {
                          event.stopPropagation()

                          openVariablesModal(true)
                        }}
                      >
                        <QuestionCircleFilled />
                      </div>
                    )

                  let componentType: ELEMENT_TYPE | undefined

                  switch (panelData.activeId) {
                    case TAB_TYPE.CHARACTERS:
                      componentType = ELEMENT_TYPE.CHARACTER
                      break
                    default:
                      break
                  }

                  return componentType ? (
                    <ElementHelpButton type={componentType} />
                  ) : null
                }
              }
            }
          ]
        }
      ]
    }
  })

  return (
    // The modal is a sibling of the DividerBox rather than a child of it.
    // DividerBox divides its space between its React children, and an antd Modal
    // is one of those even though it portals to document.body and renders nothing
    // in place — as a child it took a share of the vertical space and collapsed
    // the outline to nothing.
    <>
      <VariablesModal
        studioId={studioId}
        world={world}
        visible={variablesModal.visible}
        helpOpen={variablesModal.help}
        onCancel={() => setVariablesModal({ visible: false, help: false })}
      />

      <DividerBox className={styles.WorldInspector} mode="vertical">
        <DividerBox className={styles.outline}>
          <WorldOutline studioId={studioId} world={world} />
        </DividerBox>

        <DockLayout
          defaultLayout={defaultLayout}
          groups={{
            bottom: {
              floatable: false,
              animated: false,
              maximizable: false,
              tabLocked: true
            }
          }}
          dropMode="edge"
        />
      </DividerBox>
    </>
  )
}

WorldInspector.displayName = 'WorldInspector'

export default WorldInspector
