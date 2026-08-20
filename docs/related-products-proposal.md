# ポケモン関連商品表示＆お気に入り機能 設計提案書（改訂版）

## 1. 概要

本提案は、`pokedex-online-v3` で**ポケモン関連商品情報をDB化し、各図鑑のポケモン詳細ページに「関連商品」として表示する**機能、および**ユーザーがブラウザ内でお気に入りポケモンを保存し、お気に入りに紐づく商品情報を閲覧できる**機能を実現するための設計案です。

改訂にあたり、以下の追加要件を反映しています。

- 商品一覧は **DBにアクセスして動的に取得・更新**する
- 商品DBに **ステータス** と **発売日** を持たせ、これらで **フィルター表示** できるようにする

## 2. 追加要件に対する設計方針

「DBにアクセスして動的にリストを更新」には、以下の2つの実装方針があります。

### 2.1 方針A: Nuxt Server Routes + データベース（推奨）

Nuxt 3 の `server/api/` または `server/routes/` に商品用のAPIを実装し、PostgreSQL や SQLite などのRDBMSから動的に商品を取得します。

```text
ブラウザ
  ↓ GET /api/products?pokemonId=25&status=available&releaseDateFrom=2024-01-01
Nuxt Nitro Server
  ↓ SQL
PostgreSQL / SQLite / Supabase
```

**メリット:**

- 完全な動的DBアクセス
- フィルター・ソート・ページネーションをサーバー側で処理
- 在庫状況や発売日の変更を即座に反映可能

**デメリット:**

- 既存の「Apache への静的配置」構成からは外れる
- ホスティング先を **Vercel / Netlify / Cloudflare Pages / Nodeサーバー** 等に変更する必要がある

### 2.2 方針B: 外部BaaS（Supabase / Firebase）

Nuxt アプリは静的サイトのまま、ブラウザから Supabase Client SDK や Firebase SDK を使って商品DBに直接アクセスします。

```text
ブラウザ
  ↓ Supabase JS Client
Supabase (PostgreSQL) / Firebase
```

**メリット:**

- フロントエンドを静的ホスティング（Apache含む）したまま利用可能
- 認証・リアルタイム更新・Row Level Security が使える

**デメリット:**

- 外部サービスへの依存
- APIキー・RLS設定が必要

### 2.3 方針C: 静的JSON + クライアントサイドフィルター（制約付き）

ビルド時に全商品をJSON化し、クライアント側でフィルタリングします。DBアクセスではなく「静的データの動的フィルター」になります。

**本要件では「DBにアクセス」が明示されているため、本提案では採用しません。**

## 3. 推奨アーキテクチャ

本提案では **方針A（Nuxt Server Routes + SQLite/PostgreSQL）** を基本としつつ、必要に応じて **方針B（Supabase）** への切り替えも容易な抽象化を入れます。

```text
┌────────────────────────────────────────────────────────────────────────┐
│  フロントエンド (Nuxt 3)                                               │
│  ├─ pages/pokedex/[area]/[id].vue   # 関連商品セクション                 │
│  ├─ components/ProductList.vue      # フィルターUI + 商品一覧            │
│  ├─ components/ProductFilter.vue    # ステータス・発売日フィルター        │
│  ├─ composables/useProducts.ts    # 商品APIクライアント                │
│  └─ composables/useFavorites.ts   # お気に入り（localStorage）         │
├────────────────────────────────────────────────────────────────────────┤
│  APIレイヤー (Nuxt Server Routes)                                      │
│  ├─ server/api/products/index.get.ts   # 商品一覧取得（フィルター対応）  │
│  ├─ server/api/products/[id].get.ts    # 商品詳細取得                    │
│  ├─ server/utils/db.ts                 # DB接続・クエリ抽象化            │
│  └─ server/utils/productRepository.ts  # 商品リポジトリ                │
├────────────────────────────────────────────────────────────────────────┤
│  データベース                                                          │
│  ├─ PostgreSQL（本番推奨）                                             │
│  └─ SQLite（開発・ローカル or 少量データ）                             │
├────────────────────────────────────────────────────────────────────────┤
│  既存静的データ                                                        │
│  └─ generated-data/pokemon/, region/ 等 # ポケモン図鑑データは静的のまま │
└────────────────────────────────────────────────────────────────────────┘
```

## 4. 商品DBスキーマ

### 4.1 `products` テーブル

| カラム名 | 型 | 説明 |
|----------|-----|------|
| `id` | `TEXT` / `UUID` PRIMARY KEY | 商品ID |
| `name` | `TEXT` NOT NULL | 商品名 |
| `description` | `TEXT` | 商品説明 |
| `category` | `TEXT` | `plush`, `figure`, `card`, `stationery`, `game`, `apparel`, `other` |
| `price` | `INTEGER` | 税抜価格（任意） |
| `currency` | `TEXT` | `JPY` 等 |
| `image_url` | `TEXT` | 商品画像URL |
| `url` | `TEXT` NOT NULL | 商品ページURL |
| `source` | `TEXT` | `amazon`, `rakuten`, `yahoo`, `pokemon-center`, `other` |
| `status` | `TEXT` NOT NULL | `available`（販売中）, `pre_order`（予約受付中）, `sold_out`（売切）, `unreleased`（未発売）, `discontinued`（販売終了） |
| `release_date` | `DATE` | 発売日（ISO 8601: `YYYY-MM-DD`） |
| `is_available` | `BOOLEAN` | `available` / `pre_order` の場合 true。`status` から導出可能だが、検索高速化用 |
| `tags` | `TEXT[]` / `JSON` | 検索・フィルタ用タグ |
| `affiliate_info` | `JSON` | ASP用追跡情報 |
| `created_at` | `TIMESTAMP` | 作成日時 |
| `updated_at` | `TIMESTAMP` | 更新日時 |

### 4.2 `product_pokemon_mappings` テーブル

| カラム名 | 型 | 説明 |
|----------|-----|------|
| `product_id` | `TEXT` / `UUID` | 外部キー |
| `pokemon_id` | `TEXT` NOT NULL | 全国No or フォームID（`25`, `25_00000000_0_000_0` 等） |
| `priority` | `INTEGER` | 表示順。小さいほど先頭 |

### 4.3 インデックス

```sql
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_release_date ON products(release_date);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_mappings_pokemon ON product_pokemon_mappings(pokemon_id);
CREATE INDEX idx_mappings_product ON product_pokemon_mappings(product_id);
```

## 5. API設計

### 5.1 商品一覧取得

```http
GET /api/products?pokemonId=25&status=available&releaseDateFrom=2024-01-01&releaseDateTo=2024-12-31&limit=20&offset=0
```

**クエリパラメータ:**

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `pokemonId` | `string` | ポケモンID。カンマ区切りで複数指定可 |
| `status` | `string` | カンマ区切り。`available,pre_order` 等 |
| `releaseDateFrom` | `YYYY-MM-DD` | 発売日（開始） |
| `releaseDateTo` | `YYYY-MM-DD` | 発売日（終了） |
| `category` | `string` | カンマ区切り |
| `search` | `string` | 商品名・説明・タグの部分一致 |
| `sort` | `string` | `release_date_desc`, `release_date_asc`, `price_asc`, `price_desc`, `priority_asc` |
| `limit` | `number` | 最大取得件数。デフォルト 20 |
| `offset` | `number` | ページネーションオフセット |

**レスポンス例:**

```json
{
  "items": [
    {
      "id": "plush-pikachu-s",
      "name": "ピカチュウ ぬいぐるみ S",
      "category": "plush",
      "price": 2200,
      "currency": "JPY",
      "imageUrl": "/images/products/plush-pikachu-s.jpg",
      "url": "https://...",
      "source": "pokemon-center",
      "status": "available",
      "releaseDate": "2024-03-15",
      "tags": ["ぬいぐるみ", "ピカチュウ"]
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### 5.2 商品詳細取得

```http
GET /api/products/{id}
```

### 5.3 Server Route 実装例

```typescript
// server/api/products/index.get.ts
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { pokemonId, status, releaseDateFrom, releaseDateTo, limit = 20, offset = 0 } = query

  const products = await getProducts({
    pokemonId: parsePokemonIdList(pokemonId),
    statuses: parseStatusList(status),
    releaseDateFrom,
    releaseDateTo,
    limit: Number(limit),
    offset: Number(offset)
  })

  return products
})
```

### 5.4 DB接続抽象化

```typescript
// server/utils/productRepository.ts
export interface ProductFilter {
  pokemonId?: string[]
  statuses?: string[]
  releaseDateFrom?: string
  releaseDateTo?: string
  limit?: number
  offset?: number
}

export async function getProducts(filter: ProductFilter) {
  // 環境変数 or 設定で PostgreSQL / SQLite / Supabase を切り替え
}
```

## 6. 既存の静的Pokédexデータとの共存

商品情報だけを動的化し、Pokédexデータは既存の `generated-data/` 静的JSONを維持します。

```text
静的: /data/pokemon/0025.json      → ポケモン詳細情報
動的: /api/products?pokemonId=25   → 関連商品（フィルター可能）
```

この分離により:

- 既存のビルドパイプライン `scripts/build-data.ts` は変更しない、または最小限の変更にとどめる
- 商品DB更新時に全ページを再ビルドする必要がない
- Pokédexページの初回表示は高速に保たれる

## 7. フロントエンド実装

### 7.1 商品用 Composable

```typescript
// composables/useProducts.ts
export interface ProductQuery {
  pokemonId?: string | string[]
  status?: string | string[]
  releaseDateFrom?: string
  releaseDateTo?: string
  search?: string
  sort?: string
  limit?: number
  offset?: number
}

export function useProducts() {
  const fetchProducts = (query: ProductQuery) => {
    return $fetch('/api/products', { query: buildProductQuery(query) })
  }

  return { fetchProducts }
}
```

### 7.2 フィルターUI

```vue
<!-- components/ProductFilter.vue -->
<template>
  <form class="product-filter" @submit.prevent>
    <fieldset>
      <legend>ステータス</legend>
      <label><input v-model="selectedStatuses" type="checkbox" value="available"> 販売中</label>
      <label><input v-model="selectedStatuses" type="checkbox" value="pre_order"> 予約受付中</label>
      <label><input v-model="selectedStatuses" type="checkbox" value="sold_out"> 売切</label>
      <label><input v-model="selectedStatuses" type="checkbox" value="unreleased"> 未発売</label>
      <label><input v-model="selectedStatuses" type="checkbox" value="discontinued"> 販売終了</label>
    </fieldset>

    <fieldset>
      <legend>発売日</legend>
      <input v-model="releaseDateFrom" type="date">
      <span>〜</span>
      <input v-model="releaseDateTo" type="date">
    </fieldset>

    <button type="button" @click="applyFilter">絞り込み</button>
    <button type="button" @click="resetFilter">リセット</button>
  </form>
</template>
```

### 7.3 商品一覧 + フィルター連携

```vue
<!-- components/ProductList.vue -->
<template>
  <section>
    <ProductFilter v-model="filter" @update="onFilterUpdate" />

    <div v-if="pending">読み込み中...</div>
    <div v-else-if="error">エラーが発生しました。</div>
    <ul v-else class="product-list">
      <li v-for="product in data?.items" :key="product.id">
        <ProductCard :product="product" />
      </li>
    </ul>

    <button v-if="hasMore" @click="loadMore">もっと見る</button>
  </section>
</template>
```

### 7.4 詳細ページへの組み込み

```vue
<!-- pages/pokedex/[area]/[id].vue の関連箇所 -->
<section class="pokemon-products">
  <h2 class="section-title">関連商品</h2>
  <ProductList :pokemon-id="pokemon.id" />
</section>
```

## 8. お気に入り機能

### 8.1 保存先

現時点では **ブラウザ内 `localStorage`** を使用します。将来的にユーザーアカウントを導入した場合、DBへの移行が可能です。

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

### 8.2 お気に入り商品ページ

`/favorites/products` で、お気に入りポケモンIDを `pokemonId` クエリパラメータとして `/api/products` に渡します。

```http
GET /api/products?pokemonId=25,6,133&status=available&sort=release_date_desc
```

## 9. 実装ステップ

### Phase 1: 環境整備とDB設計

1. ホスティング方針を確定（Server Routes + PostgreSQL / SQLite / Supabase）
2. DBスキーマを作成（`products`, `product_pokemon_mappings`）
3. `server/utils/db.ts` でDB接続を抽象化
4. `server/utils/productRepository.ts` を実装
5. `server/api/products/index.get.ts` を実装（フィルター対応）

### Phase 2: フロントエンド実装

1. `types/product.ts` に型定義を追加
2. `composables/useProducts.ts` を作成
3. `components/ProductFilter.vue` を作成
4. `components/ProductCard.vue` / `components/ProductList.vue` を作成
5. `pages/pokedex/[area]/[id].vue` に関連商品セクションを追加

### Phase 3: お気に入り機能

1. `composables/useFavorites.ts` を作成
2. ポケモン詳細ページに「お気に入り」ボタンを追加
3. `/favorites` ページを新設
4. `/favorites/products` ページでお気に入り商品をまとめ表示

### Phase 4: 運用・管理機能

1. 商品データの登録・更新用の簡易管理画面 or API
2. 商品データのCSV/JSONインポート機能
3. 在庫・ステータス更新の自動化（外部API連携 or 定期実行）
4. URL死活確認・価格監視のCIジョブ

## 10. セキュリティ・法務・パフォーマンス上の注意

### セキュリティ

- DB接続情報は `.env` で管理し、クライアントに漏出しない
- SQLインジェクション対策: プリペアドステートメントを使用
- 外部商品URLは入力時にサニタイズ（`javascript:` 等を拒否）
- アフィリエイトIDなどはサーバー側で注入

### 法務・表記

- 商品画像は著作権に注意。公式サイトへのリンクのみを掲載する形が無難
- PR・スポンサードリンクには `rel="sponsored"` を付与
- 価格表記は「参考価格」や税込み/税抜きの明記を徹底
- 未発売商品の表示には注意喚起を入れる

### パフォーマンス

- `status`, `release_date`, `pokemon_id` にインデックスを張る
- `limit`/`offset` を上限設定（例: max 100）
- 商品画像は `loading="lazy"` + 適切な `width/height`
- Nuxtの `useFetch` / `useAsyncData` でキャッシュ戦略を設定

## 11. 既存「Apache静的ホスティング」からの移行について

動的DBアクセスを実現するには、以下のいずれかの移行が必要です。

| 移行パターン | 内容 |
|--------------|------|
| **A. Node/Edgeホスティングへ移行** | Vercel / Netlify / Cloudflare Pages / Nodeサーバー でNuxt Server Routesを使用 |
| **B. APIを分離** | Apache上に静的Nuxtを置き、商品APIだけ別サーバー（EC2/Cloud Run等）で提供 |
| **C. BaaSを使用** | 静的サイトのまま Supabase/Firebase から動的取得 |

## 12. まとめ

改訂版の設計では、**商品情報をDB（PostgreSQL/SQLite/Supabase）で管理し、Nuxt Server Routes 経由で動的に取得・更新**します。`status` と `release_date` を含むフィルターUIを実装し、既存の静的Pokédexデータとは分離して動作させます。お気に入りは引き続き `localStorage` でブラウザ内保存とし、将来的に認証基盤を追加すればDBに移行できます。

次のステップとして、**まずホスティング方針を確定**し、**Phase 1（DB設計 + API実装）** を進めることを推奨します。
