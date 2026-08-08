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

const AddComponentIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8 4H6V8H2V10H6V14H8V10H12V8H8V4Z" fill="white" />
  </svg>
)

const WorldInspector: React.FC<{ studioId: StudioId; world: World }> = ({
  studioId,
  world
}) => {
  const { composerDispatch } = useContext(ComposerContext)

  // Read by the Variables tab title below, which is captured in defaultLayout on
  // the first render. A setter's identity is stable, so the closure stays valid.
  // `help` opens the manager onto its reference rather than onto the list;
  // `add` opens it onto the add prompt, so a new variable is named before it
  // exists rather than found again afterwards
  const [variablesModal, setVariablesModal] = useState({
    visible: false,
    help: false,
    add: false
  })

  const openVariablesModal = (help = false, add = false) =>
    setVariablesModal({ visible: true, help, add })

  const addCharacter = async () => {
    if (!world.id) return

    // TODO: change to lib method
    const character = await api().characters.saveCharacter(studioId, {
      description: undefined,
      worldId: world.id,
      masks: [{ type: CHARACTER_MASK_TYPE.NEUTRAL, active: true }],
      refs: [],
      tags: [],
      title: uniqueNamesGenerator({
        dictionaries: [names, names],
        length: 2,
        separator: ' '
      })
    })

    character.id &&
      composerDispatch({
        type: COMPOSER_ACTION_TYPE.OPEN_CHARACTER_MODAL,
        characterId: character.id
      })
  }

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
                  // Add/manage/help actions live in the panel's `panelExtra`
                  // below, which rc-dock renders only for the active tab — so
                  // they cannot fire from an inactive tab's title (#92).
                  title: <div>Characters</div>,
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
                  // #92 fixed: the manage/add/help actions moved to `panelExtra`
                  // below, which rc-dock renders only for the active tab, so they
                  // no longer fire from this title while another tab is active.
                  title: <div>Variables</div>,
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
                  // Every tab's actions live here rather than in its title,
                  // because rc-dock renders `panelExtra` only for the *active*
                  // tab — so add/manage/help cannot fire from an inactive tab
                  // (#92). The variables help stays in the app rather than behind
                  // a link (ElementHelpButton opens docs.elmstory.com, which no
                  // longer resolves; the remaining element types still point
                  // there).
                  if (panelData.activeId === TAB_TYPE.VARIABLES)
                    return (
                      <>
                        <Tooltip
                          title="Manage Variables..."
                          mouseEnterDelay={1}
                        >
                          <span
                            className={styles.tabManageButton}
                            onClick={(event) => {
                              event.stopPropagation()

                              openVariablesModal()
                            }}
                          >
                            <UnorderedListOutlined />
                          </span>
                        </Tooltip>

                        <span
                          className={styles.tabAddComponentButton}
                          onClick={(event) => {
                            event.stopPropagation()

                            // the panel is an index now, so a new variable is
                            // named and nameable in the manager
                            openVariablesModal(false, true)
                          }}
                        >
                          <AddComponentIcon />
                        </span>

                        <div
                          className={helpButtonStyles.ElementHelpButton}
                          onClick={(event) => {
                            event.stopPropagation()

                            openVariablesModal(true)
                          }}
                        >
                          <QuestionCircleFilled />
                        </div>
                      </>
                    )

                  if (panelData.activeId === TAB_TYPE.CHARACTERS)
                    return (
                      <>
                        <span
                          className={styles.tabAddComponentButton}
                          onClick={(event) => {
                            event.stopPropagation()

                            addCharacter()
                          }}
                        >
                          <AddComponentIcon />
                        </span>

                        <ElementHelpButton type={ELEMENT_TYPE.CHARACTER} />
                      </>
                    )

                  return null
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
        addOpen={variablesModal.add}
        onCancel={() =>
          setVariablesModal({ visible: false, help: false, add: false })
        }
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
