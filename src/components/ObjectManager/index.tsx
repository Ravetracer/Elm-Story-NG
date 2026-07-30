import React, { useCallback, useState } from 'react'

import { ElementId, StudioId, WorldId } from '../../data/types'

import { Tabs } from 'antd'

import Objects from './Objects'
import Recipes from './Recipes'

import styles from './styles.module.less'

enum OBJECT_TAB {
  OBJECTS = 'OBJECTS',
  RECIPES = 'RECIPES'
}

/**
 * Objects and their recipes, in one place.
 *
 * Two panes rather than one, because a recipe relates two or more objects and
 * belongs to none of them — it cannot be a section inside a single object's form
 * without picking an arbitrary owner. What it *can* do is be reachable from
 * either side, which is why the selection lives here: the objects pane lists the
 * recipes naming the selected object, and clicking one switches tab and selects
 * it. `TODO.md` asks for exactly that.
 *
 * A tab rather than a sixth button in the outline's title bar. The title bar just
 * gained a row of its own for growing into, but "recipes" is not a peer of "the
 * asset manager" — it is the other half of the thing the objects button opens.
 */
const ObjectManager: React.FC<{
  studioId: StudioId
  worldId: WorldId
}> = ({ studioId, worldId }) => {
  const [activeTab, setActiveTab] = useState<OBJECT_TAB>(OBJECT_TAB.OBJECTS)

  const [selectedObjectId, setSelectedObjectId] = useState<
    ElementId | undefined
  >(undefined)

  const [selectedRecipeId, setSelectedRecipeId] = useState<
    ElementId | undefined
  >(undefined)

  const openRecipe = useCallback((recipeId: ElementId) => {
    setSelectedRecipeId(recipeId)
    setActiveTab(OBJECT_TAB.RECIPES)
  }, [])

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => setActiveTab(key as OBJECT_TAB)}
      className={styles.tabs}
    >
      <Tabs.TabPane tab="Objects" key={OBJECT_TAB.OBJECTS}>
        <Objects
          studioId={studioId}
          worldId={worldId}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
          onOpenRecipe={openRecipe}
        />
      </Tabs.TabPane>

      <Tabs.TabPane tab="Recipes" key={OBJECT_TAB.RECIPES}>
        <Recipes
          studioId={studioId}
          worldId={worldId}
          selectedRecipeId={selectedRecipeId}
          onSelectRecipe={setSelectedRecipeId}
        />
      </Tabs.TabPane>
    </Tabs>
  )
}

ObjectManager.displayName = 'ObjectManager'

export default ObjectManager
