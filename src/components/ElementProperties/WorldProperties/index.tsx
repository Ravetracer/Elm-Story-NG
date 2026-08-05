import semver from 'semver'

import React, { useEffect, useState } from 'react'

import { WorldId, StudioId } from '../../../data/types'

import { useWorld, useScenes } from '../../../hooks'

import { Button, Collapse, Form, Input } from 'antd'

import ElementTitle from '../ElementTitle'
import ChoicePresentationSelect from '../../ChoicePresentationSelect'
import TransitionSelect from '../../TransitionSelect'
import WorldCover from './WorldCover'
import WorldBackground from './WorldBackground'
import WorldColors from './WorldColors'
import JumpTo from '../../JumpTo'

import parentStyles from '../styles.module.less'
import styles from './styles.module.less'

import api from '../../../api'

const WorldProperties: React.FC<{
  studioId: StudioId
  worldId: WorldId
}> = ({ studioId, worldId }) => {
  const world = useWorld(studioId, worldId, [studioId, worldId]),
    scenes = useScenes(studioId, worldId, [studioId, worldId])

  const [metadataForm] = Form.useForm()

  const [unsavedMetadataChanges, setUnsavedMetadataChanges] = useState(false)

  async function onCreateJump() {
    if (world?.id && scenes && scenes[0].id) {
      const { id: jumpId } = await api().jumps.saveJump(studioId, {
        worldId: world.id,
        title: 'On World Start Jump',
        path: [scenes[0].id],
        tags: []
      })

      jumpId &&
        (await api().worlds.saveJumpRefToWorld(studioId, worldId, jumpId))
    }
  }

  async function saveGameMetadata({
    copyright,
    description,
    designer,
    version,
    website
  }: {
    copyright: string
    description: string
    designer: string
    version: string
    website: string
  }) {
    if (world?.id) {
      setUnsavedMetadataChanges(false)

      try {
        await api().worlds.saveWorld(studioId, {
          ...(await api().worlds.getWorld(studioId, world.id)),
          copyright,
          description,
          designer,
          version,
          website
        })
      } catch (error) {
        throw error
      }
    }
  }

  useEffect(() => {
    metadataForm.resetFields()
    setUnsavedMetadataChanges(false)
  }, [world])

  return (
    <>
      {world && (
        <div
          className={`${parentStyles.componentDetailViewWrapper} ${styles.WorldProperties}`}
        >
          <div className={parentStyles.content}>
            <ElementTitle
              title={world.title}
              onUpdate={async (title) => {
                if (world.id) {
                  await api().worlds.saveWorld(studioId, {
                    ...(await api().worlds.getWorld(studioId, world.id)),
                    title
                  })

                  // composerDispatch({
                  //   type: EDITOR_ACTION_TYPE.COMPONENT_RENAME,
                  //   renamedElement: {
                  //     id: game.id,
                  //     newTitle: title
                  //   }
                  // })
                }
              }}
            />

            <div className={parentStyles.componentId}>{world.id}</div>
          </div>

          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['jump-panel']}>
              <Collapse.Panel
                header="Jump on Start"
                key="jump-panel"
                style={{ borderBottom: 'none' }}
              >
                {scenes && (
                  <div
                    className={`${parentStyles.content} ${styles.jumpPanel}`}
                  >
                    {scenes.length === 0 && (
                      <div className="warningMessage">
                        To modify jump on world start, define at least 1 scene.
                      </div>
                    )}

                    {scenes.length > 0 && (
                      <>
                        {!world.jump && (
                          <>
                            <Button type="primary" onClick={onCreateJump}>
                              Create Jump
                            </Button>
                          </>
                        )}

                        {world.jump && (
                          <>
                            <JumpTo
                              studioId={studioId}
                              jumpId={world.jump}
                              width={244}
                              onRemove={async () => {
                                world.id &&
                                  api().worlds.saveJumpRefToWorld(
                                    studioId,
                                    world.id,
                                    null
                                  )
                              }}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Collapse.Panel>
            </Collapse>
          </div>

          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['cover-panel']}>
              <Collapse.Panel header="Cover" key="cover-panel">
                <div className={parentStyles.content}>
                  <WorldCover studioId={studioId} world={world} />
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>

          {/*
            BACKGROUND

            Filled behind the engine's reading column, in the window's gutters
            around the 68rem column. A separate slot from the cover: the cover is a
            card image, the background is full-bleed at play.
          */}
          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['background-panel']}>
              <Collapse.Panel header="Background" key="background-panel">
                <div className={parentStyles.content}>
                  <WorldBackground studioId={studioId} world={world} />
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>

          {/*
            COLORS

            Overrides of the base theme's colours, layered over the player's
            chosen theme. Keyed on the world id so switching storyworlds remounts
            it with the new world's colours.
          */}
          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['colors-panel']}>
              <Collapse.Panel header="Colors" key="colors-panel">
                <div className={parentStyles.content}>
                  <WorldColors
                    key={world.id}
                    studioId={studioId}
                    world={world}
                  />
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>

          {/*
            CHOICES

            The storyworld's default presentation, which every event follows unless
            it overrides it in its own properties. Above Metadata because it changes
            what the player sees rather than what the About box says.
          */}
          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['choices-panel']}>
              <Collapse.Panel header="Choices" key="choices-panel">
                <div className={parentStyles.content}>
                  <ChoicePresentationSelect
                    value={world.choicePresentation}
                    onChange={async (choicePresentation) => {
                      if (!world.id) return

                      await api().worlds.saveWorld(studioId, {
                        // re-read rather than spreading the rendered copy: this
                        // panel's metadata form writes to the same row
                        ...(await api().worlds.getWorld(studioId, world.id)),
                        choicePresentation
                      })
                    }}
                  />

                  <div className={styles.choicesHint}>
                    How an event offers its choices. Any event can override this.
                    Not the same as an inline choice, which is one choice placed
                    inside a sentence from the content editor.
                  </div>
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>

          {/*
            TRANSITIONS

            How a new event enters the stream. World-wide, with no per-event
            override — the feel of the storyworld rather than a per-page decision.
          */}
          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['transitions-panel']}>
              <Collapse.Panel header="Transitions" key="transitions-panel">
                <div className={parentStyles.content}>
                  <TransitionSelect
                    value={world.transition}
                    onChange={async (transition) => {
                      if (!world.id) return

                      await api().worlds.saveWorld(studioId, {
                        // re-read rather than spreading the rendered copy: this
                        // panel's metadata form writes to the same row
                        ...(await api().worlds.getWorld(studioId, world.id)),
                        transition
                      })
                    }}
                  />

                  <div className={styles.choicesHint}>
                    How each new event enters the story. A player who prefers
                    reduced motion sees no animation whatever you choose here.
                  </div>
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>

          <div className={parentStyles.elementPropertiesNestedCollapse}>
            <Collapse defaultActiveKey={['metadata-panel']}>
              <Collapse.Panel header="Metadata" key="metadata-panel">
                <div className={parentStyles.content}>
                  <Form
                    id="save-world-metadata-form"
                    form={metadataForm}
                    initialValues={{
                      copyright: world.copyright,
                      description: world.description,
                      designer: world.designer,
                      version: world.version,
                      website: world.website
                    }}
                    onChange={() => setUnsavedMetadataChanges(true)}
                    onFinish={saveGameMetadata}
                  >
                    <Form.Item
                      label="Designer"
                      name="designer"
                      rules={[
                        { required: true, message: 'Designer is required.' }
                      ]}
                      labelCol={{ span: 10 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Version"
                      name="version"
                      rules={[
                        {
                          required: true,
                          message: 'Version is required.'
                        },
                        {
                          message: 'Semantic version required.',
                          validator: (_, value) =>
                            new Promise((resolve, reject) =>
                              semver.valid(value)
                                ? resolve('Valid version.')
                                : reject('Semantic version required.')
                            )
                        }
                      ]}
                      labelCol={{ span: 10 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Description"
                      name="description"
                      labelCol={{ span: 10 }}
                    >
                      <Input.TextArea autoSize />
                    </Form.Item>
                    <Form.Item
                      label="Copyright"
                      name="copyright"
                      labelCol={{ span: 10 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      label="Website"
                      name="website"
                      labelCol={{ span: 10 }}
                      style={{ marginBottom: unsavedMetadataChanges ? 15 : 0 }}
                    >
                      <Input />
                    </Form.Item>

                    <Button
                      type="primary"
                      htmlType="submit"
                      style={{
                        display: unsavedMetadataChanges ? 'unset' : 'none',
                        width: '100%'
                      }}
                    >
                      Save
                    </Button>
                  </Form>
                </div>
              </Collapse.Panel>
            </Collapse>
          </div>
        </div>
      )}
    </>
  )
}

WorldProperties.displayName = 'WorldProperties'

export default WorldProperties
