# ポケモン関連商品表示＆お気に入り機能 設計提案書

## 1. 概要

本提案は、`pokedex-online-v3` で**ポケモン関連商品情報をDB化し、各図鑑のポケモン詳細ページに「関連商品」として表示する**機能、および将来の拡張として**ユーザーがブラウザ内でお気に入りポケモンを保存し、お気に入りに紐づく商品情報を閲覧できる**機能を実現するための設計案です。

現状のサイトは **Nuxt 3 を使った完全静的サイト**であり、Apache などの静的ホスティングで動作します。したがって商品情報も「ビルド時に生成された静的JSON」として扱い、お気に入り情報はブラウザ内の `localStorage`（または将来的に同期ストレージ）に保存する方向で設計しています。

## 2. 現状のアーキテクチャとの関係

現状のデータフロー:

```text
pokedex repo
    ↓
scripts/build-data.ts
    ↓
generated-data/ （pokemon/, region/, index.json, search-index.json など）
    ↓
nuxt generate
    ↓
dist/ （静的サイト）
```

商品情報も同様に、**ビルド時に generated-data に組み込む**形が最も自然です。これにより:

- 既存の `usePokedex()` による `/data/` 配下のJSON読み込み機構を流用できる
- ランタイムにサーバーが不要
- CDN 配信に最適

## 3. 提案する全体構成

```text
┌────────────────────────────────────────────────────────────────┐
│  pokedex-online-v3                                             │
│  ├─ data/products.ts           # 商品マスター（手動 or 自動編集）│
│  ├─ data/product-mappings.ts   # 商品↔ポケモン紐付け              │
│  ├─ scripts/build-data.ts      # 既存ビルドスクリプト            │
│  │                              # 商品データを generated-data へ  │
│  ├─ generated-data/            # ビルド成果物（gitignore）       │
│  │   ├─ products/index.json    # 商品一覧                         │
│  │   ├─ products/by-pokemon/   # ポケモン別商品JSON               │
│  │   │   ├─ 0025.json          # e.g. ピカチュウ関連商品          │
│  │   │   └─ ...                                                 │
│  │   └─ pokemon/                 # 既存                           │
│  │       ├─ 0025.json            # 既存のポケモン詳細に          │
│  │       │                       # productIds フィールド追加      │
│  └─ pages/pokedex/[area]/[id].vue # 関連商品セクション追加        │
└────────────────────────────────────────────────────────────────┘
```

## 4. 商品情報のDB化

### 4.1 商品データの定義場所

商品データはリポジトリ内にマスターとして保持します。

```text
data/
  products.ts         # 商品エンティティ定義 + 配列データ
  product-mappings.ts # pokemon_id → product_id[] の紐付け
```

`.ts` 形式にすることで型チェック・自動補完が効き、編集ミスを減らせます。将来的にスプレッドシートや外部DBから生成する場合は、これらのファイルを生成対象にするだけです。

### 4.2 商品データスキーマ

```typescript
export interface Product {
  id: string               // 例: "pkmc-plush-pikachu-001"
  name: string             // 例: "ピカチュウ ぬいぐるみ S"
  description?: string
  category: 'plush' | 'figure' | 'card' | 'stationery' | 'game' | 'apparel' | 'other'
  price?: number           // 税抜想定価格（任意）
  currency?: string        // 例: "JPY"
  imageUrl?: string        // 商品画像URL or /images/products/xxx.png
  url: string              // アフィリエイト or 商品ページURL
  source: 'amazon' | 'rakuten' | 'yahoo' | 'pokemon-center' | 'other'
  releaseDate?: string     // ISO 8601 (YYYY-MM-DD)
  isAvailable: boolean
  tags?: string[]          // 検索・フィルタ用
  affiliateInfo?: {
    trackingId?: string
    // 各ASP用の追加情報
  }
}

export interface ProductMapping {
  pokemonId: string        // 全国No or フォームID
  productIds: string[]
}
```

### 4.3 データ例

```typescript
// data/products.ts
export const products: Product[] = [
  {
    id: 'plush-pikachu-s',
    name: 'ピカチュウ ぬいぐるみ S',
    category: 'plush',
    price: 2200,
    imageUrl: '/images/products/plush-pikachu-s.jpg',
    url: 'https://www.pokemoncenter-online.com/...',
    source: 'pokemon-center',
    isAvailable: true,
    tags: ['ぬいぐるみ', 'ピカチュウ']
  },
  {
    id: 'card-pikachu-vmax',
    name: 'ポケモンカード ピカチュウVMAX',
    category: 'card',
    url: 'https://...',
    source: 'amazon',
    isAvailable: true
  }
]

// data/product-mappings.ts
export const productMappings: ProductMapping[] = [
  { pokemonId: '25', productIds: ['plush-pikachu-s', 'card-pikachu-vmax'] },
  { pokemonId: '26', productIds: ['plush-raichu-s'] }
]
```

### 4.4 紐付けルール

| ルール | 内容 |
|--------|------|
| `pokemonId` | 全国図鑑Noを優先。フォーム違いの場合は既存の `formatPokemonRouteId` と同じID体系（例: `25_00000000_0_000_0`）を使用 |
| 1商品 ↔ 複数ポケモン | 可能。例: 「イーブイ進化セット」はイーブイ + 各進化形に紐付け |
| 並び順 | `productIds` の配列順で表示。優先度が高いものほど先頭 |
| 表示制限 | デフォルトで最大8件まで、UI上「もっと見る」で全件表示 |

## 5. 関連商品表示機能

### 5.1 ビルドパイプラインへの追加

`scripts/build-data.ts` を拡張し、以下を生成します。

```text
generated-data/
  products/
    index.json              # 全商品マスター（検索用）
    by-pokemon/
      0025.json             # ピカチュウ関連商品
      0026.json             # ライチュウ関連商品
      ...
```

各ポケモンの `generated-data/pokemon/{id}.json` には `productIds` または `products` フィールドを追加することも可能ですが、**関連商品を別ファイル化**することで、商品データを後から追加・更新してもポケモンデータの再生成を最小化できます。

### 5.2 フロントエンド実装

`usePokedex()` に商品読み込みメソッドを追加します。

```typescript
const loadProductsByPokemon = (id: number | string) =>
  loadGeneratedData<Product[]>(`products/by-pokemon/${formatPokemonRouteId(id)}.json`)
```

`pages/pokedex/[area]/[id].vue` の既存の `AdSenseCard` セクションの近くに「関連商品」セクションを追加します。例:

```vue
<section class="pokemon-products">
  <h2 class="section-title">関連商品</h2>
  <ProductList :pokemon-id="pokemon.id" />
</section>
```

新規コンポーネント:

- `components/ProductCard.vue` — 1商品のカード表示
- `components/ProductList.vue` — 商品一覧。空の場合は非表示

### 5.3 UIデザイン指針

- カードは横長タイプ（画像 + 商品名 + カテゴリ + 価格）
- 外部リンクは `target="_blank" rel="noopener sponsored"`
- 広告・PR ラベルは `adsense.config.json` の `labels.sponsored` と連携
- 画像がない場合は `PokemonCard` と同系統のプレースホルダ

## 6. お気に入り機能

### 6.1 保存先: ブラウザ内 (localStorage / IndexedDB)

現状、サイトはユーザーアカウントやサーバーを持たないため、お気に入りは**ブラウザ内に保存**します。

```typescript
// composables/useFavorites.ts
export function useFavorites() {
  const favorites = useState<string[]>('favorites', () => [])

  onMounted(() => {
    const stored = localStorage.getItem('pokedex-favorites')
    if (stored) favorites.value = JSON.parse(stored)
  })

  watch(favorites, (next) => {
    localStorage.setItem('pokedex-favorites', JSON.stringify(next))
  }, { deep: true })

  const toggleFavorite = (pokemonId: string) => { /* ... */ }
  const isFavorite = (pokemonId: string) => favorites.value.includes(pokemonId)

  return { favorites: readonly(favorites), toggleFavorite, isFavorite }
}
```

### 6.2 ユーザー体験

1. **お気に入り登録**: ポケモン詳細ページに「☆ お気に入り」ボタンを配置
2. **お気に入り一覧ページ**: `/favorites` ページを新設
3. **お気に入り商品ページ**: `/favorites/products` などで、お気に入りポケモンに紐づく商品をまとめて表示

### 6.3 お気に入り商品ページの動作

ページを開いたときに:

1. `localStorage` からお気に入り `pokemonId[]` を読み込む
2. 各 `pokemonId` に対して `/data/products/by-pokemon/{id}.json` を取得
3. 取得結果を統合し、重複を除去して表示
4. ソート: 新着順 or 安い順 or カテゴリ別（将来的）

## 7. 将来的な拡張

現状の設計を前提に、後から追加しやすい拡張:

| 拡張 | 内容 |
|------|------|
| ユーザーアカウント | `localStorage` からバックエンドDB（Supabase/Firebase等）へ移行 |
| 商品検索 | `/data/products/index.json` を使ったクライアントサイド検索 |
| カテゴリ・価格フィルタ | `ProductList` コンポーネントにフィルタUI追加 |
| 在庫連携 | 外部APIを定期実行し `data/products.ts` を更新するCIジョブ |
| おすすめ商品 | 閲覧履歴やお気に入りに基づいたレコメンド（プライバシー注意） |

## 8. 実装ステップ（推奨フェーズ）

### Phase 1: 商品マスターとビルドパイプライン

1. `data/products.ts` / `data/product-mappings.ts` を作成
2. `scripts/build-data.ts` で `generated-data/products/` を出力する処理を追加
3. 型定義を `types/product.ts` として追加
4. 既存の `generated-data/pokemon/{id}.json` に影響がないことを確認

### Phase 2: 関連商品表示

1. `usePokedex()` に `loadProductsByPokemon` を追加
2. `components/ProductCard.vue` / `components/ProductList.vue` を作成
3. `pages/pokedex/[area]/[id].vue` に関連商品セクションを追加
4. 広告ラベル・PR表記を `AdSenseCard` と同じテストモードで表示確認

### Phase 3: お気に入り機能

1. `composables/useFavorites.ts` を作成
2. ポケモン詳細ページに「お気に入り」ボタンを追加
3. `/favorites` ページを新設
4. `/favorites/products` ページでお気に入り商品をまとめ表示

### Phase 4: 運用・拡張

1. 商品データの更新フロー（手動 or 自動）を確立
2. CIでの商品データ検証（型チェック、URL死活確認など）
3. 必要に応じてアカウント・同期機能を検討

## 9. セキュリティ・法務・パフォーマンス上の注意

### セキュリティ

- 外部商品URLは入力時にサニタイズ。`javascript:` スキーム等を拒否
- アフィリエイトIDなどは環境変数 or ビルド時変数で注入し、公開設定ファイルには直接記述しない

### 法務・表記

- 商品画像は著作権に注意。公式サイトへのリンクのみを掲載する形が無難
- PR・スポンサードリンクには `rel="sponsored"` を付与
- 価格表記は「参考価格」や税込み/税抜きの明記を徹底

### パフォーマンス

- 商品画像は `loading="lazy"` + 適切な `width/height`
- 関連商品JSONは初回表示時に必要に応じて読み込む。静的プリレンダリング時に詳細ページに埋め込むか、別途 `fetch` するかを選択可能
- `generated-data/products/by-pokemon/` のファイル数は全国図鑑数程度なので、容量は軽微

## 10. まとめ

本提案では、**既存の「完全静的な Nuxt 3 サイト」という制約を維持しつつ**、商品情報をリポジトリ内のTSマスターとしてDB化し、ビルドパイプラインで最適化されたJSONに変換します。詳細ページには関連商品セクションを追加し、お気に入りは `localStorage` でブラウザ内保存することで、サーバー不要でユーザーごとの表示を実現します。

次のステップとして、まずは **Phase 1（商品マスター + ビルドパイプライン）** を実装し、商品データが正しく生成・配信されることを確認することを推奨します。
