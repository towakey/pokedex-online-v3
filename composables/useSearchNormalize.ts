const HIRAGANA_OFFSET = 0x60

export const toHiragana = (value: string): string => {
  return value.replace(/[\u30A1-\u30F6]/g, (character) => (
    String.fromCharCode(character.charCodeAt(0) - HIRAGANA_OFFSET)
  ))
}

export const normalizeSearchText = (value: unknown): string => {
  return toHiragana(String(value ?? '').normalize('NFKC'))
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
}

export const matchesSearchQuery = (query: string, ...candidates: Array<string | number | undefined | null>): boolean => {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return true
  }

  return candidates.some((candidate) => {
    if (candidate === undefined || candidate === null) {
      return false
    }

    return normalizeSearchText(candidate).includes(normalizedQuery)
  })
}
