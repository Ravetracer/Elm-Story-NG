import { Studio } from '../../data/types'

import { Modal } from 'antd'

import api from '../../api'

/**
 * Asks before deleting a studio, and says how much goes with it.
 *
 * A studio is a whole library: `removeStudio` drops its Dexie database outright,
 * so every storyworld inside it goes at once — there is no per-world confirmation
 * on the way down and nothing to undo it with. That is a much larger deletion than
 * the button's single click suggests, which is the same reasoning behind
 * `confirmRemoveVariable` and `confirmRemoveObject`.
 *
 * The world count is read off the studio record rather than queried, because the
 * studio's `worlds` array is the app database's own list and is what the dashboard
 * is already showing.
 */
const confirmRemoveStudio = async (studio: Studio, onRemoved?: () => void) => {
  const worldCount = studio.worlds.length

  Modal.confirm({
    title: `Delete '${studio.title}'?`,
    content:
      worldCount > 0
        ? `This deletes the studio and all ${worldCount} storyworld${
            worldCount === 1 ? '' : 's'
          } inside it. This cannot be undone.`
        : 'This studio is empty. Deleting it cannot be undone.',
    okText: 'Delete Studio',
    okType: 'danger',
    cancelText: 'Cancel',
    onOk: async () => {
      if (!studio.id) return

      try {
        await api().studios.removeStudio(studio.id)

        onRemoved && onRemoved()
      } catch (error) {
        throw error
      }
    }
  })
}

export default confirmRemoveStudio
