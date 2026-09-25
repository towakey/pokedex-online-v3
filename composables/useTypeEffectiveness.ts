export const TYPE_ORDER = [
  'ノーマル',
  'ほのお',
  'みず',
  'でんき',
  'くさ',
  'こおり',
  'かくとう',
  'どく',
  'じめん',
  'ひこう',
  'エスパー',
  'むし',
  'いわ',
  'ゴースト',
  'ドラゴン',
  'あく',
  'はがね',
  'フェアリー'
] as const

export type PokemonTypeName = typeof TYPE_ORDER[number]

const ATTACK_MULTIPLIERS: Record<PokemonTypeName, Partial<Record<PokemonTypeName, number>>> = {
  ノーマル: { いわ: 0.5, ゴースト: 0, はがね: 0.5 },
  ほのお: { ほのお: 0.5, みず: 0.5, くさ: 2, こおり: 2, むし: 2, いわ: 0.5, ドラゴン: 0.5, はがね: 2 },
  みず: { ほのお: 2, みず: 0.5, くさ: 0.5, じめん: 2, いわ: 2, ドラゴン: 0.5 },
  でんき: { みず: 2, でんき: 0.5, くさ: 0.5, じめん: 0, ひこう: 2, ドラゴン: 0.5 },
  くさ: { ほのお: 0.5, みず: 2, くさ: 0.5, どく: 0.5, じめん: 2, ひこう: 0.5, むし: 0.5, いわ: 2, ドラゴン: 0.5, はがね: 0.5 },
  こおり: { ほのお: 0.5, みず: 0.5, くさ: 2, こおり: 0.5, じめん: 2, ひこう: 2, ドラゴン: 2, はがね: 0.5 },
  かくとう: { ノーマル: 2, こおり: 2, どく: 0.5, ひこう: 0.5, エスパー: 0.5, むし: 0.5, いわ: 2, ゴースト: 0, あく: 2, はがね: 2, フェアリー: 0.5 },
  どく: { くさ: 2, どく: 0.5, じめん: 0.5, いわ: 0.5, ゴースト: 0.5, はがね: 0, フェアリー: 2 },
  じめん: { ほのお: 2, でんき: 2, くさ: 0.5, どく: 2, ひこう: 0, むし: 0.5, いわ: 2, はがね: 2 },
  ひこう: { でんき: 0.5, くさ: 2, かくとう: 2, むし: 2, いわ: 0.5, はがね: 0.5 },
  エスパー: { かくとう: 2, どく: 2, エスパー: 0.5, あく: 0, はがね: 0.5 },
  むし: { ほのお: 0.5, くさ: 2, かくとう: 0.5, どく: 0.5, ひこう: 0.5, エスパー: 2, ゴースト: 0.5, あく: 2, はがね: 0.5, フェアリー: 0.5 },
  いわ: { ほのお: 2, こおり: 2, かくとう: 0.5, じめん: 0.5, ひこう: 2, むし: 2, はがね: 0.5 },
  ゴースト: { ノーマル: 0, エスパー: 2, ゴースト: 2, あく: 0.5 },
  ドラゴン: { ドラゴン: 2, はがね: 0.5, フェアリー: 0 },
  あく: { かくとう: 0.5, エスパー: 2, ゴースト: 2, あく: 0.5, フェアリー: 0.5 },
  はがね: { ほのお: 0.5, みず: 0.5, でんき: 0.5, こおり: 2, いわ: 2, はがね: 0.5, フェアリー: 2 },
  フェアリー: { ほのお: 0.5, かくとう: 2, どく: 0.5, ドラゴン: 2, あく: 2, はがね: 0.5 }
}

export type MatchupMultiplier = 4 | 2 | 1 | 0.5 | 0.25 | 0

export interface TypeMatchupGroup {
  multiplier: MatchupMultiplier
  types: string[]
}

const isPokemonTypeName = (value: string): value is PokemonTypeName => {
  return (TYPE_ORDER as readonly string[]).includes(value)
}

const getAttackMultiplier = (attacker: PokemonTypeName, defender: PokemonTypeName): number => {
  return ATTACK_MULTIPLIERS[attacker][defender] ?? 1
}

export const getDefenseMultiplier = (attacker: string, defenderTypes: string[]): number => {
  if (!isPokemonTypeName(attacker)) {
    return 1
  }

  return defenderTypes.reduce((total, defenderType) => {
    if (!isPokemonTypeName(defenderType)) {
      return total
    }

    return total * getAttackMultiplier(attacker, defenderType)
  }, 1)
}

export const getDefenseMatchupGroups = (defenderTypes: string[]): TypeMatchupGroup[] => {
  const grouped = new Map<MatchupMultiplier, string[]>()

  for (const attacker of TYPE_ORDER) {
    const multiplier = getDefenseMultiplier(attacker, defenderTypes) as MatchupMultiplier
    const current = grouped.get(multiplier) ?? []
    current.push(attacker)
    grouped.set(multiplier, current)
  }

  return ([4, 2, 0.5, 0.25, 0] as const)
    .map((multiplier) => ({
      multiplier,
      types: grouped.get(multiplier) ?? []
    }))
    .filter((group) => group.types.length > 0)
}

export const useTypeEffectiveness = () => {
  return {
    TYPE_ORDER,
    getDefenseMultiplier,
    getDefenseMatchupGroups
  }
}
