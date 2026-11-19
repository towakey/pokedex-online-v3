// 検出枠の追跡（IoU一致）とラベルの多数決安定化
export interface TrackedBox {
  x: number
  y: number
  w: number
  h: number
  score: number
}

export interface Track {
  id: number
  box: TrackedBox
  missed: number
  framesSeen: number
  votes: Array<{ index: number, score: number }>
  labelIndex: number | null
  labelScore: number
  gapWarn: boolean
}

export const boxIou = (a: TrackedBox, b: TrackedBox): number => {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return intersection / (a.w * a.h + b.w * b.h - intersection + 1e-8)
}

export const updateTracks = (tracks: Track[], boxes: TrackedBox[], iouThreshold: number, maxMissed = 3): Track[] => {
  const nextId = tracks.reduce((max, track) => Math.max(max, track.id), 0) + 1
  let idCursor = nextId
  const unmatchedBoxes = [...boxes]
  const nextTracks: Track[] = []

  for (const track of tracks) {
    let bestIndex = -1
    let bestIou = iouThreshold
    unmatchedBoxes.forEach((box, index) => {
      const value = boxIou(track.box, box)
      if (value > bestIou) {
        bestIou = value
        bestIndex = index
      }
    })
    if (bestIndex >= 0) {
      const box = unmatchedBoxes.splice(bestIndex, 1)[0]!
      nextTracks.push({ ...track, box, missed: 0, framesSeen: track.framesSeen + 1 })
    }
    else if (track.missed + 1 <= maxMissed) {
      nextTracks.push({ ...track, missed: track.missed + 1 })
    }
  }

  for (const box of unmatchedBoxes) {
    nextTracks.push({
      id: idCursor++,
      box,
      missed: 0,
      framesSeen: 1,
      votes: [],
      labelIndex: null,
      labelScore: 0,
      gapWarn: false
    })
  }

  return nextTracks
}

// 直近 window 件の投票多数決でラベルを安定化
export const voteForLabel = (votes: Array<{ index: number, score: number }>, window: number): { index: number, score: number } | null => {
  const recent = votes.slice(-window)
  if (recent.length === 0) {
    return null
  }
  const tally = new Map<number, { count: number, score: number }>()
  for (const vote of recent) {
    const entry = tally.get(vote.index) ?? { count: 0, score: 0 }
    entry.count += 1
    entry.score = Math.max(entry.score, vote.score)
    tally.set(vote.index, entry)
  }
  let best: { index: number, count: number, score: number } | null = null
  for (const [index, entry] of tally) {
    if (!best || entry.count > best.count) {
      best = { index, ...entry }
    }
  }
  return best ? { index: best.index, score: best.score } : null
}
