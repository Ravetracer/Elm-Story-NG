import {
  Character,
  CharacterMask,
  CHARACTER_MASK_TYPE,
  CHARACTER_MASK_VALUES,
  StudioId,
  WorldId
} from '../data/types'


import { names, uniqueNamesGenerator } from 'unique-names-generator'

import api from '../api'

export const getCharacterPersonalityMakeup = (activeMasks: CharacterMask[]) => {
  const value = { drive: 0, agency: 0 }

  activeMasks.map((activeMask) => {
    value.drive += CHARACTER_MASK_VALUES[activeMask.type][0]
    value.agency += CHARACTER_MASK_VALUES[activeMask.type][1]
  })

  value.drive = ((value.drive / 5) * 100) | 0
  value.agency = ((value.agency / 5) * 100) | 0

  return value
}

export const getCharacterDominateMakeup = (activeMasks: CharacterMask[]) => {
  const makeup = getCharacterPersonalityMakeup(activeMasks)

  const desireSearchArray: Array<[CHARACTER_MASK_TYPE, number]> = [
      [CHARACTER_MASK_TYPE.NEUTRAL, 0]
    ],
    agencySearchArray: Array<[CHARACTER_MASK_TYPE, number]> = [
      [CHARACTER_MASK_TYPE.NEUTRAL, 0]
    ]

  activeMasks.map((activeMask) => {
    desireSearchArray.push([
      activeMask.type,
      Math.round(CHARACTER_MASK_VALUES[activeMask.type][0] * 100)
    ])

    agencySearchArray.push([
      activeMask.type,
      Math.round(CHARACTER_MASK_VALUES[activeMask.type][1] * 100)
    ])
  })

  if (desireSearchArray.length > 0 && agencySearchArray.length > 0) {
    return {
      aggregate: makeup,
      dominate: {
        drive: desireSearchArray.reduce((prev, curr) =>
          Math.abs(curr[1] - makeup.drive) < Math.abs(prev[1] - makeup.drive)
            ? curr
            : prev
        )[0],
        agency: agencySearchArray.reduce((prev, curr) =>
          Math.abs(curr[1] - makeup.agency) < Math.abs(prev[1] - makeup.agency)
            ? curr
            : prev
        )[0]
      }
    }
  }

  return {
    aggregate: makeup,
    dominate: {
      drive: CHARACTER_MASK_TYPE.NEUTRAL,
      agency: CHARACTER_MASK_TYPE.NEUTRAL
    }
  }
}

export const createGenericCharacter = async (
  studioId: StudioId,
  worldId: WorldId
): Promise<Character> =>
  await api().characters.saveCharacter(studioId, {
    description: undefined,
    worldId,
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
  })
