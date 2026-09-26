const typeColors: Record<string, string> = {
  ノーマル: '#999999',
  ほのお: '#ff3333',
  みず: '#3399ff',
  でんき: '#ffcc00',
  くさ: '#339933',
  こおり: '#33ccff',
  かくとう: '#ff9900',
  どく: '#9933cc',
  じめん: '#996633',
  ひこう: '#99ccff',
  エスパー: '#ff3366',
  むし: '#999900',
  いわ: '#cccc99',
  ゴースト: '#663366',
  ドラゴン: '#6666ff',
  あく: '#333333',
  はがね: '#6699cc',
  フェアリー: '#ff66ff'
}

const hexToRgb = (hex: string) => {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

const toLinearChannel = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * toLinearChannel(r) + 0.7152 * toLinearChannel(g) + 0.0722 * toLinearChannel(b)
}

const mixHex = (from: string, to: string, weight: number) => {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const mix = (x: number, y: number) => Math.round(x + (y - x) * weight)
  const r = mix(a.r, b.r)
  const g = mix(a.g, b.g)
  const bl = mix(a.b, b.b)
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}

const MAX_PANEL_LUMINANCE = 0.22

export const useTypeColor = () => {
  const getTypeColor = (type: string) => typeColors[type] ?? '#607d8b'

  const getTypePanelColor = (type: string) => {
    let color = getTypeColor(type)
    for (let i = 0; i < 8 && relativeLuminance(color) > MAX_PANEL_LUMINANCE; i += 1) {
      color = mixHex(color, '#141824', 0.22)
    }
    return color
  }

  return {
    getTypeColor,
    getTypePanelColor
  }
}
