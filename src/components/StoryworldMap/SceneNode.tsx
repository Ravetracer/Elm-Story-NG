import React, { memo } from 'react'

import { Handle, Position } from 'react-flow-renderer'

import { Tooltip } from 'antd'
import {
  FlagOutlined,
  PartitionOutlined,
  RedoOutlined,
  WarningOutlined
} from '@ant-design/icons'

import { StoryworldMapNode } from '../../lib/storyworldMap'

import styles from './styles.module.less'

/**
 * One scene on the storyworld map.
 *
 * The handles are hidden rather than absent: react-flow will not draw an edge to
 * a node that has no handle to draw to, but nothing is connected from here — the
 * connections are jumps, authored inside a scene.
 */
const SceneNode: React.FC<{ data: StoryworldMapNode }> = ({ data }) => (
  <div
    className={`${styles.SceneNode} ${data.isStart ? styles.isStart : ''} ${
      data.hasNoWayIn ? styles.hasNoWayIn : ''
    }`}
    title={data.title}
  >
    <Handle
      type="target"
      position={Position.Left}
      className={styles.handle}
      isConnectable={false}
    />

    {data.folderPath.length > 0 && (
      <div className={styles.folderPath}>{data.folderPath.join(' / ')}</div>
    )}

    <div className={styles.title}>
      <PartitionOutlined className={styles.sceneIcon} />
      {data.title}
    </div>

    <div className={styles.meta}>
      <span>
        {data.childCount} {data.childCount === 1 ? 'element' : 'elements'}
      </span>

      {data.isStart && (
        <Tooltip title="The storyworld opens here" mouseEnterDelay={0.4}>
          <span className={styles.start}>
            <FlagOutlined /> start
          </span>
        </Tooltip>
      )}

      {data.selfJumps > 0 && (
        <Tooltip
          title={`${data.selfJumps} jump${
            data.selfJumps === 1 ? '' : 's'
          } back into this scene`}
          mouseEnterDelay={0.4}
        >
          <span className={styles.selfJumps}>
            <RedoOutlined /> {data.selfJumps}
          </span>
        </Tooltip>
      )}

      {data.hasNoWayIn && (
        <Tooltip
          title="Nothing jumps to this scene and the storyworld does not open here, so it cannot be reached while playing."
          mouseEnterDelay={0.4}
        >
          <span className={styles.noWayIn}>
            <WarningOutlined /> no way in
          </span>
        </Tooltip>
      )}
    </div>

    <Handle
      type="source"
      position={Position.Right}
      className={styles.handle}
      isConnectable={false}
    />
  </div>
)

SceneNode.displayName = 'SceneNode'

export default memo(SceneNode)
