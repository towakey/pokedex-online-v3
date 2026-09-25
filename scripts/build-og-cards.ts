import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'

interface PokemonRecord {
  id: string
  dex: number
  name: string
  names?: Record<string, string>
  types?: string[]
  classification?: string
  classifications?: Record<string, string>
  stats?: Record<string, number>
}

interface OgManifestEntry {
  hash: string
}

const rootDir = process.cwd()
const generatedDir = resolve(rootDir, 'generated-data')
const pokemonDir = resolve(generatedDir, 'pokemon')
const outputDir = resolve(rootDir, 'public', 'images', 'og')
const cacheDir = resolve(rootDir, '.cache', 'og-fonts')
const manifestPath = resolve(outputDir, '.manifest.json')
const width = 1200
const height = 630

const typeColors: Record<string, string> = {
  ノーマル: '#A8A77A',
  ほのお: '#EE8130',
  みず: '#6390F0',
  でんき: '#F7D02C',
  くさ: '#7AC74C',
  こおり: '#96D9D6',
  かくとう: '#C22E28',
  どく: '#A33EA1',
  じめん: '#E2BF65',
  ひこう: '#A98FF3',
  エスパー: '#F95587',
  むし: '#A6B91A',
  いわ: '#B6A136',
  ゴースト: '#735797',
  ドラゴン: '#6F35FC',
  あく: '#705746',
  はがね: '#B7B7CE',
  フェアリー: '#D685AD'
}

const getTypeColor = (type?: string) => typeColors[type ?? ''] ?? '#607d8b'

const statLabels: Record<string, string> = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  special_attack: 'とくこう',
  special_defense: 'とくぼう',
  speed: 'すばやさ'
}

const statKeys = ['hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed']

const base64Image = (path: string): string | undefined => {
  try {
    const data = readFileSync(path)
    const ext = path.split('.').pop()?.toLowerCase() ?? 'png'
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${data.toString('base64')}`
  }
  catch {
    return undefined
  }
}

const findPokemonImage = (id: string): string | undefined => {
  const candidates = [
    resolve(rootDir, 'public', 'images', 'pokemon', `${id}_00000000_0_000_0.png`),
    resolve(rootDir, 'public', 'images', 'pokemon', `${id}.png`),
    resolve(rootDir, '.output', 'public', 'images', 'pokemon', `${id}_00000000_0_000_0.png`),
    resolve(rootDir, '.output', 'public', 'images', 'pokemon', `${id}.png`)
  ]

  for (const candidate of candidates) {
    const found = base64Image(candidate)
    if (found) {
      return found
    }
  }

  return undefined
}

const downloadFile = async (url: string, targetPath: string) => {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(targetPath, buffer)
}

const loadFonts = async () => {
  const envPath = process.env.OG_FONT_PATH
  if (envPath) {
    const parts = envPath.split(';').filter(Boolean)
    return parts.map((path, index) => {
      const data = readFileSync(path.trim())
      return {
        name: 'Noto Sans JP',
        data,
        weight: index === 0 ? 400 : 700,
        style: 'normal' as const
      }
    })
  }

  mkdirSync(cacheDir, { recursive: true })

  const regularFile = resolve(cacheDir, 'NotoSansCJKjp-Regular.otf')
  const boldFile = resolve(cacheDir, 'NotoSansCJKjp-Bold.otf')

  const fontUrls = [
    {
      path: regularFile,
      url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf',
      fallbackUrl: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf'
    },
    {
      path: boldFile,
      url: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf',
      fallbackUrl: 'https://github.com/googlefonts/noto-cjk/raw/main/Sans/OTF/Japanese/NotoSansCJKjp-Bold.otf'
    }
  ]

  for (const { path, url, fallbackUrl } of fontUrls) {
    if (existsSync(path)) {
      continue
    }
    try {
      await downloadFile(url, path)
    }
    catch {
      console.warn(`Failed to download from ${url}, trying fallback...`)
      await downloadFile(fallbackUrl, path)
    }
  }

  return [
    { name: 'Noto Sans JP', data: readFileSync(regularFile), weight: 400, style: 'normal' as const },
    { name: 'Noto Sans JP', data: readFileSync(boldFile), weight: 700, style: 'normal' as const }
  ]
}

const hashSource = (record: PokemonRecord): string => {
  const source = [
    record.name,
    record.dex,
    record.types?.join(','),
    record.classification,
    statKeys.map((key) => `${key}:${record.stats?.[key] ?? 0}`).join(',')
  ].join('|')
  return createHash('sha1').update(source).digest('hex')
}

const loadManifest = (): Record<string, OgManifestEntry> => {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, OgManifestEntry>
  }
  catch {
    return {}
  }
}

const saveManifest = (manifest: Record<string, OgManifestEntry>) => {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
}

const renderPng = async (svg: string): Promise<Buffer> => {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { defaultFontFamily: 'Noto Sans JP' }
  })
  const png = resvg.render().asPng()
  const compressed = await sharp(png)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
  return compressed
}

const createSvg = async (node: any, fonts: any[]) => {
  return await satori(node, {
    width,
    height,
    fonts
  })
}

const background = (color: string) => ({
  background: `linear-gradient(135deg, #0f172a 0%, ${color}44 60%, #0f172a 100%)`
})

const Badge = (label: string, color: string) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 16px',
      borderRadius: '9999px',
      backgroundColor: `${color}cc`,
      color: '#ffffff',
      fontSize: 22,
      fontWeight: 700,
      marginRight: 10,
      marginBottom: 10,
      textShadow: '0 1px 2px rgba(0,0,0,0.4)'
    },
    children: label
  }
})

const generateDefaultCard = async (fonts: any[]) => {
  const svg = await createSvg({
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        color: '#ffffff',
        ...background('#3b82f6')
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 72, fontWeight: 700, marginBottom: 20 },
            children: 'Pokédex-Online'
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 32, color: '#cbd5e1', marginBottom: 40, textAlign: 'center' },
            children: '全国図鑑から地方図鑑まで、ポケモンの種族値・タイプ・特性・図鑑説明を検索できるサイト'
          }
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: 16, marginTop: 20 },
            children: ['検索', '図鑑', 'タグ'].map((text) => ({
              type: 'div',
              props: {
                style: {
                  padding: '10px 24px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  fontSize: 24
                },
                children: text
              }
            }))
          }
        }
      ]
    }
  }, fonts)

  const png = await renderPng(svg)
  writeFileSync(resolve(outputDir, 'default.png'), png)
}

const generatePokemonCard = async (record: PokemonRecord, fonts: any[]) => {
  const primaryType = record.types?.[0]
  const primaryColor = getTypeColor(primaryType)
  const imageData = findPokemonImage(record.id)
  const dexNumber = `No.${String(record.dex).padStart(4, '0')}`
  const name = record.name
  const classification = record.classification ?? record.classifications?.jpn ?? ''
  const stats = record.stats ?? {}

  const statChildren = statKeys.map((key) => ({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginRight: 16,
        minWidth: 56
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 14, color: '#94a3b8', marginBottom: 4 },
            children: statLabels[key]
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 24, fontWeight: 700, color: '#ffffff' },
            children: String(stats[key] ?? 0)
          }
        }
      ]
    }
  }))

  const children: any[] = [
    {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: 32,
          left: 40,
          fontSize: 24,
          color: '#94a3b8',
          fontWeight: 700
        },
        children: 'Pokédex-Online'
      }
    },
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: imageData ? '55%' : '100%',
          height: '100%',
          padding: '0 60px'
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 28, color: '#94a3b8', marginBottom: 8, fontWeight: 700 },
              children: dexNumber
            }
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 72, fontWeight: 700, color: '#ffffff', marginBottom: 16, lineHeight: 1.1 },
              children: name
            }
          },
          {
            type: 'div',
            props: {
              style: { fontSize: 24, color: '#cbd5e1', marginBottom: 24 },
              children: classification
            }
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexWrap: 'wrap', marginBottom: 24 },
              children: (record.types ?? []).map((type) => Badge(type, getTypeColor(type)))
            }
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex' },
              children: statChildren
            }
          }
        ]
      }
    }
  ]

  if (imageData) {
    children.unshift({
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          right: 60,
          top: 0,
          bottom: 0,
          width: '40%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        children: {
          type: 'img',
          props: {
            src: imageData,
            width: 360,
            height: 360,
            style: { objectFit: 'contain' }
          }
        }
      }
    })
  }

  const svg = await createSvg({
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        ...background(primaryColor)
      },
      children
    }
  }, fonts)

  const png = await renderPng(svg)
  const fileName = `${String(record.dex).padStart(4, '0')}.png`
  writeFileSync(resolve(outputDir, fileName), png)
}

const run = async () => {
  mkdirSync(outputDir, { recursive: true })

  console.log('Loading fonts...')
  const fonts = await loadFonts()

  console.log('Generating default card...')
  await generateDefaultCard(fonts)

  if (!existsSync(pokemonDir)) {
    console.warn('Pokemon data not found. Skipping per-pokemon cards.')
    return
  }

  const files = readdirSync(pokemonDir)
    .filter((file) => /^\d{4}\.json$/.test(file))
    .sort()

  const manifest = loadManifest()
  const nextManifest: Record<string, OgManifestEntry> = {}
  const skipped: string[] = []
  const generated: string[] = []

  console.log(`Generating ${files.length} pokemon cards...`)

  for (let i = 0; i < files.length; i += 10) {
    const chunk = files.slice(i, i + 10)
    await Promise.all(chunk.map(async (file) => {
      const record = JSON.parse(readFileSync(resolve(pokemonDir, file), 'utf-8')) as PokemonRecord
      const hash = hashSource(record)
      const dex = String(record.dex).padStart(4, '0')
      nextManifest[dex] = { hash }

      if (manifest[dex]?.hash === hash && existsSync(resolve(outputDir, `${dex}.png`))) {
        skipped.push(dex)
        return
      }

      await generatePokemonCard(record, fonts)
      generated.push(dex)
    }))

    if ((i + 10) % 100 === 0 || i + 10 >= files.length) {
      console.log(`  ...${Math.min(i + 10, files.length)}/${files.length} done`)
    }
  }

  saveManifest(nextManifest)
  console.log(`Done. Generated ${generated.length}, skipped ${skipped.length}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
