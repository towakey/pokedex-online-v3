// onnxruntime-web の WASM ランタイムを public/ort/ にコピーする
// dev / generate の前に実行（public/ort は gitignore 対象で毎回生成する）
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'node_modules/onnxruntime-web/dist')
const OUT = resolve(process.cwd(), 'public/ort')

const FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs'
]

if (!existsSync(DIST)) {
  console.error('onnxruntime-web が見つかりません。npm install を実行してください')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
for (const file of FILES) {
  copyFileSync(resolve(DIST, file), resolve(OUT, file))
}
console.log(`ort runtime -> public/ort (${FILES.length} files)`)
