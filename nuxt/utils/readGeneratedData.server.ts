import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const readGeneratedData = async <T>(relativePath: string): Promise<T> => {
  const absolutePath = resolve(process.cwd(), 'generated-data', relativePath)
  const file = await readFile(absolutePath, 'utf-8')
  return JSON.parse(file) as T
}
