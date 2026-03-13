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

export const useTypeColor = () => {
  const getTypeColor = (type: string) => typeColors[type] ?? '#607d8b'

  return {
    getTypeColor
  }
}
