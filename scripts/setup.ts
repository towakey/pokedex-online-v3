import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = process.cwd()
const pokedexDir = resolve(rootDir, 'pokedex')

if (existsSync(pokedexDir)) {
  console.log('pokedex repository already exists. Skip clone.')
  process.exit(0)
}

console.log('Cloning towakey/pokedex ...')

const result = spawnSync('git', ['clone', 'https://github.com/towakey/pokedex.git', 'pokedex'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (result.status !== 0) {
  throw new Error('Failed to clone towakey/pokedex. Please confirm that git is installed and network access is available.')
}

console.log('Clone completed.')
