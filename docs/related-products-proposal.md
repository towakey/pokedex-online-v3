# ポケモン関連商品表示＆お気に入り機能 設計提案書（改訂版）

## 1. 概要

本提案は、`pokedex-online-v3` で**ポケモン関連商品情報をDB化し、各図鑑のポケモン詳細ページに「関連商品」として表示する**機能、および**ユーザーがブラウザ内でお気に入りポケモンを保存し、お気に入りに紐づく商品情報を閲覧できる**機能を実現するための設計案です。

改訂にあたり、以下の追加要件を反映しています。

- 商品DBを **SQLite または MySQL** で管理する
- 商品一覧は **同じサーバーの別ディレクトリに配置したAPI 経由で動的に取得**する
- 商品DBに **ステータス** と **発売日** を持たせ、これらで **フィルター表示** できるようにする
- Nuxt の静的生成（`nuxt generate`）部分はそのまま維持する

## 2. 全体構成

```text
同一サーバー
├── /var/www/html/pokedex-online/    # Nuxt 静的生成サイト（Apache配信）
│   ├── index.html
│   ├── pokedex/
│   └── ...
│
└── /var/www/html/pokedex-api/       # 商品API（別ディレクトリ）
    ├── products/                    # 商品一覧・検索API
    ├── init/                        # DB初期化スクリプト
    └── db/                          # SQLiteの場合はDBファイルを配置
```

```text
ブラウザ
  ↓ GET https://example.com/pokedex-api/products.php?pokemonId=25&status=available
APIディレクトリ (PHP / Node / Python)
  ↓ SQL
SQLite / MySQL
```

## 3. なぜ同じサーバーの別ディレクトリか

- 既存の Nuxt 静的サイト（`nuxt generate` 産物）を **Apache 静的ホスティングのまま**運用できる
- 商品情報だけを **動的API** に切り出すことで、Pokédexデータの再ビルドなしに商品情報を更新できる
- サーバー管理・認証・SSL証明書を一元化できる

## 4. API の実装言語選択

同じサーバー（Apache）上で動作させる場合、以下の選択肢があります。

| 言語 | 備考 |
|------|------|
| **PHP** | 共有サーバーでも動作しやすく、SQLite/MySQL 両方に対応。推奨。 |
| **Node.js** | Nuxt プロジェクトと言語統一できるが、Apache 上ではリバースプロキシ or PM2 が必要。 |
| **Python** | mod_wsgi や CGI で動かせるが、共有サーバーでは制約が多い。 |

本提案では、**共有サーバーでも動かしやすい PHP + SQLite** を基本例とします。MySQL を使う場合も接続文字列を変えるだけでほぼ同じ構造が使えます。

## 5. データベース設計

### 5.1 `products` テーブル

| カラム名 | 型 | 説明 |
|----------|-----|------|
| `id` | `TEXT` PRIMARY KEY | 商品ID。例: `plush-pikachu-s` |
| `name` | `TEXT` NOT NULL | 商品名 |
| `description` | `TEXT` | 商品説明 |
| `category` | `TEXT` | `plush`, `figure`, `card`, `stationery`, `game`, `apparel`, `other` |
| `price` | `INTEGER` | 税抜価格（任意） |
| `currency` | `TEXT` | `JPY` 等 |
| `image_url` | `TEXT` | 商品画像URL |
| `url` | `TEXT` NOT NULL | 商品ページURL |
| `source` | `TEXT` | `amazon`, `rakuten`, `yahoo`, `pokemon-center`, `other` |
| `status` | `TEXT` NOT NULL | `available`（販売中）, `pre_order`（予約受付中）, `sold_out`（売切）, `unreleased`（未発売）, `discontinued`（販売終了） |
| `release_date` | `TEXT` | ISO 8601 (`YYYY-MM-DD`) |
| `tags` | `TEXT` | カンマ区切りのタグ |
| `affiliate_info` | `TEXT` | JSON形式のASP用追跡情報 |
| `created_at` | `TEXT` | ISO 8601 日時 |
| `updated_at` | `TEXT` | ISO 8601 日時 |

### 5.2 `product_pokemon_mappings` テーブル

| カラム名 | 型 | 説明 |
|----------|-----|------|
| `product_id` | `TEXT` NOT NULL | 外部キー |
| `pokemon_id` | `TEXT` NOT NULL | 全国No or フォームID（`25`, `25_00000000_0_000_0` 等） |
| `priority` | `INTEGER` | 表示順。小さいほど先頭 |

### 5.3 インデックス

```sql
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_release_date ON products(release_date);
CREATE INDEX IF NOT EXISTS idx_mappings_pokemon ON product_pokemon_mappings(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_mappings_product ON product_pokemon_mappings(product_id);
```

### 5.4 初期化SQL（SQLite 例）

```sql
-- init/schema.sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price INTEGER,
  currency TEXT,
  image_url TEXT,
  url TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL,
  release_date TEXT,
  tags TEXT,
  affiliate_info TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_pokemon_mappings (
  product_id TEXT NOT NULL,
  pokemon_id TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  PRIMARY KEY (product_id, pokemon_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_release_date ON products(release_date);
CREATE INDEX IF NOT EXISTS idx_mappings_pokemon ON product_pokemon_mappings(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_mappings_product ON product_pokemon_mappings(product_id);
```

## 6. API 設計

### 6.1 エンドポイント

```text
GET /pokedex-api/products.php?pokemonId=25&status=available&releaseDateFrom=2024-01-01&releaseDateTo=2024-12-31&limit=20&offset=0
```

### 6.2 クエリパラメータ

| パラメータ | 型 | 説明 |
|------------|-----|------|
| `pokemonId` | `string` | ポケモンID。カンマ区切りで複数指定可 |
| `status` | `string` | カンマ区切り。`available,pre_order` 等 |
| `releaseDateFrom` | `YYYY-MM-DD` | 発売日（開始） |
| `releaseDateTo` | `YYYY-MM-DD` | 発売日（終了） |
| `category` | `string` | カンマ区切り |
| `search` | `string` | 商品名・説明・タグの部分一致 |
| `sort` | `string` | `release_date_desc`, `release_date_asc`, `price_asc`, `price_desc`, `priority_asc` |
| `limit` | `number` | 最大取得件数。デフォルト 20、最大 100 |
| `offset` | `number` | ページネーションオフセット |

### 6.3 レスポンス例

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

### 6.4 PHP 実装例（SQLite）

```php
<?php
// /pokedex-api/products.php
header('Content-Type: application/json; charset=utf-8');

// CORS: 同一サーバー内であっても別ディレクトリ/別サブドメインの場合は必要
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['https://example.com']; // Nuxt サイトのドメイン
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dbPath = __DIR__ . '/db/products.db';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pokemonId = $_GET['pokemonId'] ?? '';
$status = $_GET['status'] ?? '';
$releaseDateFrom = $_GET['releaseDateFrom'] ?? '';
$releaseDateTo = $_GET['releaseDateTo'] ?? '';
$category = $_GET['category'] ?? '';
$search = $_GET['search'] ?? '';
$sort = $_GET['sort'] ?? 'priority_asc';
$limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
$offset = max(0, intval($_GET['offset'] ?? 0));

$conditions = [];
$params = [];

if ($pokemonId !== '') {
    $ids = array_filter(array_map('trim', explode(',', $pokemonId)));
    if ($ids) {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $conditions[] = "m.pokemon_id IN ($placeholders)";
        $params = array_merge($params, $ids);
    }
}

if ($status !== '') {
    $statuses = array_filter(array_map('trim', explode(',', $status)));
    if ($statuses) {
        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
        $conditions[] = "p.status IN ($placeholders)";
        $params = array_merge($params, $statuses);
    }
}

if ($releaseDateFrom !== '') {
    $conditions[] = "p.release_date >= ?";
    $params[] = $releaseDateFrom;
}

if ($releaseDateTo !== '') {
    $conditions[] = "p.release_date <= ?";
    $params[] = $releaseDateTo;
}

if ($category !== '') {
    $categories = array_filter(array_map('trim', explode(',', $category)));
    if ($categories) {
        $placeholders = implode(',', array_fill(0, count($categories), '?'));
        $conditions[] = "p.category IN ($placeholders)";
        $params = array_merge($params, $categories);
    }
}

if ($search !== '') {
    $conditions[] = "(p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)";
    $like = '%' . $search . '%';
    $params = array_merge($params, [$like, $like, $like]);
}

$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

$orderBy = match ($sort) {
    'release_date_desc' => 'p.release_date DESC NULLS LAST, m.priority ASC',
    'release_date_asc' => 'p.release_date ASC NULLS LAST, m.priority ASC',
    'price_asc' => 'p.price ASC NULLS LAST, m.priority ASC',
    'price_desc' => 'p.price DESC NULLS LAST, m.priority ASC',
    default => 'm.priority ASC, p.release_date DESC NULLS LAST'
};

$countSql = "SELECT COUNT(DISTINCT p.id) FROM products p JOIN product_pokemon_mappings m ON p.id = m.product_id $where";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$total = $countStmt->fetchColumn();

$sql = "SELECT DISTINCT p.*, m.priority FROM products p
        JOIN product_pokemon_mappings m ON p.id = m.product_id
        $where
        ORDER BY $orderBy
        LIMIT ? OFFSET ?";

$stmt = $pdo->prepare($sql);
$stmt->execute([...$params, $limit, $offset]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$items = array_map(function ($row) {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'description' => $row['description'] ?? null,
        'category' => $row['category'],
        'price' => $row['price'] !== null ? (int)$row['price'] : null,
        'currency' => $row['currency'] ?? null,
        'imageUrl' => $row['image_url'] ?? null,
        'url' => $row['url'],
        'source' => $row['source'],
        'status' => $row['status'],
        'releaseDate' => $row['release_date'] ?? null,
        'tags' => $row['tags'] ? array_map('trim', explode(',', $row['tags'])) : [],
        'priority' => (int)$row['priority'],
    ];
}, $rows);

echo json_encode([
    'items' => $items,
    'total' => (int)$total,
    'limit' => $limit,
    'offset' => $offset
], JSON_UNESCAPED_UNICODE);
```

### 6.5 MySQL 接続に変更する場合

```php
$host = 'localhost';
$dbname = 'pokedex_products';
$username = 'db_user';
$password = 'db_password';

$pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
```

SQL はほぼ同じです。ただし SQLite の `NULLS LAST` は MySQL 8.0+ でないと使えないため、`IFNULL(release_date, '9999-12-31')` 等で置き換えてください。

## 7. Nuxt フロントエンド側の変更

### 7.1 環境変数

`.env` に API のベースURLを追加します。

```bash
NUXT_PUBLIC_PRODUCT_API_URL=https://example.com/pokedex-api
```

### 7.2 商品用 Composable

```typescript
// composables/useProducts.ts
export interface ProductQuery {
  pokemonId?: string | string[]
  status?: string | string[]
  releaseDateFrom?: string
  releaseDateTo?: string
  category?: string | string[]
  search?: string
  sort?: 'release_date_desc' | 'release_date_asc' | 'price_asc' | 'price_desc' | 'priority_asc'
  limit?: number
  offset?: number
}

export interface Product {
  id: string
  name: string
  description?: string
  category: string
  price?: number
  currency?: string
  imageUrl?: string
  url: string
  source: string
  status: 'available' | 'pre_order' | 'sold_out' | 'unreleased' | 'discontinued'
  releaseDate?: string
  tags: string[]
}

export interface ProductListResponse {
  items: Product[]
  total: number
  limit: number
  offset: number
}

function buildProductQuery(query: ProductQuery): Record<string, string> {
  const result: Record<string, string> = {}
  if (query.pokemonId) result.pokemonId = Array.isArray(query.pokemonId) ? query.pokemonId.join(',') : query.pokemonId
  if (query.status) result.status = Array.isArray(query.status) ? query.status.join(',') : query.status
  if (query.releaseDateFrom) result.releaseDateFrom = query.releaseDateFrom
  if (query.releaseDateTo) result.releaseDateTo = query.releaseDateTo
  if (query.category) result.category = Array.isArray(query.category) ? query.category.join(',') : query.category
  if (query.search) result.search = query.search
  if (query.sort) result.sort = query.sort
  if (query.limit) result.limit = String(query.limit)
  if (query.offset !== undefined) result.offset = String(query.offset)
  return result
}

export function useProducts() {
  const config = useRuntimeConfig()
  const baseURL = config.public.productApiUrl?.replace(/\/$/, '') ?? '/pokedex-api'

  const fetchProducts = (query: ProductQuery): Promise<ProductListResponse> => {
    return $fetch(`${baseURL}/products.php`, {
      query: buildProductQuery(query)
    })
  }

  return { fetchProducts }
}
```

### 7.3 フィルターUI

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

    <button type="button" @click="apply">絞り込み</button>
    <button type="button" @click="reset">リセット</button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  update: [filter: { status: string[]; releaseDateFrom: string; releaseDateTo: string }]
}>()

const selectedStatuses = ref<string[]>([])
const releaseDateFrom = ref('')
const releaseDateTo = ref('')

const apply = () => {
  emit('update', {
    status: selectedStatuses.value,
    releaseDateFrom: releaseDateFrom.value,
    releaseDateTo: releaseDateTo.value
  })
}

const reset = () => {
  selectedStatuses.value = []
  releaseDateFrom.value = ''
  releaseDateTo.value = ''
  apply()
}
</script>
```

### 7.4 商品一覧コンポーネント

```vue
<!-- components/ProductList.vue -->
<template>
  <section class="product-list-section">
    <ProductFilter @update="onFilterUpdate" />

    <div v-if="pending">読み込み中...</div>
    <div v-else-if="error">エラーが発生しました。</div>
    <ul v-else-if="data?.items.length" class="product-list">
      <li v-for="product in data.items" :key="product.id">
        <ProductCard :product="product" />
      </li>
    </ul>
    <p v-else>該当する商品がありません。</p>

    <button v-if="hasMore" @click="loadMore">もっと見る</button>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { ProductListResponse, ProductQuery } from '~/composables/useProducts'

interface Props {
  pokemonId: string | number
}

const props = defineProps<Props>()
const { fetchProducts } = useProducts()

const filter = reactive({
  status: [] as string[],
  releaseDateFrom: '',
  releaseDateTo: ''
})

const query = computed<ProductQuery>(() => ({
  pokemonId: String(props.pokemonId),
  status: filter.status,
  releaseDateFrom: filter.releaseDateFrom,
  releaseDateTo: filter.releaseDateTo,
  limit: 20,
  offset: 0
}))

const { data, pending, error, refresh } = useAsyncData<ProductListResponse>(
  () => `products-${props.pokemonId}-${JSON.stringify(filter)}`,
  () => fetchProducts(query.value),
  { server: false, default: () => ({ items: [], total: 0, limit: 20, offset: 0 }) }
)

const onFilterUpdate = (next: { status: string[]; releaseDateFrom: string; releaseDateTo: string }) => {
  filter.status = next.status
  filter.releaseDateFrom = next.releaseDateFrom
  filter.releaseDateTo = next.releaseDateTo
  refresh()
}
</script>
```

### 7.5 詳細ページへの組み込み

```vue
<!-- pages/pokedex/[area]/[id].vue の関連箇所 -->
<section class="pokemon-products">
  <h2 class="section-title">関連商品</h2>
  <ProductList :pokemon-id="pokemon.id" />
</section>
```

## 8. お気に入り機能

### 8.1 保存先

現時点では **ブラウザ内 `localStorage`** を使用します。

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

  const toggleFavorite = (pokemonId: string) => {
    const index = favorites.value.indexOf(pokemonId)
    if (index >= 0) favorites.value.splice(index, 1)
    else favorites.value.push(pokemonId)
  }
  const isFavorite = (pokemonId: string) => favorites.value.includes(pokemonId)

  return { favorites: readonly(favorites), toggleFavorite, isFavorite }
}
```

### 8.2 お気に入り商品ページ

`/favorites/products` で、お気に入りポケモンIDを `pokemonId` クエリに渡して API を叩きます。

```vue
<script setup lang="ts">
const { favorites } = useFavorites()
const { fetchProducts } = useProducts()

const { data } = useAsyncData('favorite-products', () => {
  if (favorites.value.length === 0) {
    return Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 })
  }
  return fetchProducts({
    pokemonId: favorites.value,
    status: ['available', 'pre_order'],
    sort: 'release_date_desc',
    limit: 100
  })
}, { server: false })
</script>
```

## 9. サーバー配置と Apache 設定例

### 9.1 ディレクトリ構成例

```text
/var/www/html/
├── pokedex-online/         # Nuxt 静的サイト
│   ├── index.html
│   └── pokedex/
│       └── [area]/
│           └── [id]/
│               └── index.html
└── pokedex-api/            # 商品API
    ├── products.php
    ├── init.php
    └── db/
        └── products.db     # SQLite の場合
```

### 9.2 Apache 設定例

```apache
# /etc/apache2/sites-available/pokedex-online.conf

# Nuxt 静的サイト
<Directory "/var/www/html/pokedex-online">
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

# API ディレクトリ
<Directory "/var/www/html/pokedex-api">
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

`.htaccess` で Nuxt の SPA/静的ルーティングに対応する場合は、必要に応じて `index.html` フォールバックを設定してください。

### 9.3 CORS 設定

API が **同一ドメインの別ディレクトリ** 配下の場合、`example.com/pokedex-api/products.php` と `example.com/pokedex-online/` は同一オリジンと見なされるため、CORS は原則不要です。

ただし、開発時や別サブドメインを使う場合は `products.php` の先頭に CORS ヘッダーを追加してください。

```php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['https://example.com', 'https://dev.example.com'];
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
```

## 10. 実装ステップ

### Phase 1: API 基盤構築

1. サーバーに `/pokedex-api/` ディレクトリを作成
2. `init/schema.sql` と `init/seed.php` を作成し、SQLite/MySQL のテーブルを作成
3. `products.php` を実装（検索・フィルター対応）
4. `db/products.db`（SQLite）または MySQL DB を作成

### Phase 2: フロントエンド統合

1. `.env` / `.env.production` に `NUXT_PUBLIC_PRODUCT_API_URL` を追加
2. `types/product.ts` に型定義を追加
3. `composables/useProducts.ts` を作成
4. `components/ProductFilter.vue` / `components/ProductCard.vue` / `components/ProductList.vue` を作成
5. `pages/pokedex/[area]/[id].vue` に関連商品セクションを追加

### Phase 3: お気に入り機能

1. `composables/useFavorites.ts` を作成
2. ポケモン詳細ページに「お気に入り」ボタンを追加
3. `/favorites` ページを新設
4. `/favorites/products` ページでお気に入り商品をまとめ表示

### Phase 4: 定期クロール・商品登録システム

1. `cron` で1日1回 `cron/fetch-products.php` を実行
2. 各ASP/APIから商品情報を取得
3. 取得データを正規化し `products` テーブルへ upsert
4. ログ・エラー管理用の `crawl_logs` テーブルに記録

### Phase 5: 運用・管理

1. 商品登録・更新用の管理画面 or 簡易APIを作成
2. CSV/JSON インポート機能
3. 手動での在庫・価格確認機能

## 11. 定期クロール・商品登録システム

### 11.1 目的

- 各ECサイト（ポケモンセンター、Amazon、楽天、Yahoo!ショッピング等）から**1日1回**程度の頻度で商品情報を取得
- 取得した情報を SQLite/MySQL の `products` テーブルに登録・更新
- 価格変更、在庫ステータス変更、新商品追加を自動検知

### 11.2 システム構成

```text
サーバー
├── /var/www/html/pokedex-online/       # Nuxt 静的サイト
└── /var/www/html/pokedex-api/          # 商品API + クローラー
    ├── cron/
    │   └── fetch-products.php          # cron から毎日実行
    ├── lib/
    │   ├── Database.php                  # DB接続
    │   ├── ProductRepository.php         # 商品 upsert
    │   ├── PokemonMatcher.php            # ポケモン名⇔キーワード紐付け
    │   ├── CrawlerLogger.php             # ログ記録
    │   ├── sources/
    │   │   ├── PokemonCenterCrawler.php
    │   │   ├── AmazonProductApi.php
    │   │   ├── RakutenIchibaApi.php
    │   │   └── YahooShoppingApi.php
    └── db/
        └── products.db
```

### 11.3 cron 設定例

```cron
# 毎日午前3時に実行
0 3 * * * /usr/bin/php /var/www/html/pokedex-api/cron/fetch-products.php >> /var/log/pokedex-api/cron.log 2>&1
```

### 11.4 取得元（ASP/API）の例

| 取得元 | 方法 | 備考 |
|--------|------|------|
| **ポケモンセンターオンライン** | Webスクレイピング or 公式API | robots.txt / 利用規約を確認。画像リンクや商品URL取得に留める |
| **Amazon** | Product Advertising API (PA-API 5.0) | APIキー・AssociateTagが必要。利用規約に注意 |
| **楽天市場** | 楽天商品検索API | アプリID取得が必要。1日のAPI上限あり |
| **Yahoo!ショッピング** | Yahoo!ショッピングAPI | アプリケーションID取得が必要 |

### 11.5 ポケモン紐付けロジック

```php
// lib/PokemonMatcher.php
class PokemonMatcher {
    private array $pokemonKeywords;

    public function __construct(PDO $pdo) {
        $this->pokemonKeywords = $this->loadKeywords($pdo);
    }

    private function loadKeywords(PDO $pdo): array {
        // 全国図鑑マスターから pokemon_id と検索キーワードを取得
        $stmt = $pdo->query("SELECT pokemon_id, name FROM pokemon_keywords");
        return $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    }

    public function match(string $productName, string $description): array {
        $matches = [];
        foreach ($this->pokemonKeywords as $pokemonId => $keyword) {
            if (str_contains($productName, $keyword) || str_contains($description, $keyword)) {
                $matches[] = $pokemonId;
            }
        }
        return $matches;
    }
}
```

### 11.6 商品正規化・upsert 処理

```php
// cron/fetch-products.php（抜粋）
<?php
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../lib/Database.php';
require __DIR__ . '/../lib/ProductRepository.php';
require __DIR__ . '/../lib/PokemonMatcher.php';
require __DIR__ . '/../lib/sources/PokemonCenterCrawler.php';
require __DIR__ . '/../lib/sources/RakutenIchibaApi.php';

$db = Database::connect();
$repo = new ProductRepository($db);
$matcher = new PokemonMatcher($db);

$sources = [
    new PokemonCenterCrawler(),
    new RakutenIchibaApi($_ENV['RAKUTEN_APP_ID'] ?? ''),
];

foreach ($sources as $source) {
    try {
        $items = $source->fetch('ポケモン ぬいぐるみ'); // 取得クエリ
        foreach ($items as $item) {
            $product = normalizeProduct($item);
            $pokemonIds = $matcher->match($product['name'], $product['description'] ?? '');
            if (empty($pokemonIds)) {
                continue; // ポケモンと紐付かない商品は無視
            }
            $repo->upsert($product, $pokemonIds);
        }
    } catch (Throwable $e) {
        CrawlerLogger::error($source->getName(), $e->getMessage());
    }
}

function normalizeProduct(array $item): array {
    return [
        'id' => $item['itemCode'] ?? $item['id'],
        'name' => $item['itemName'] ?? $item['name'],
        'description' => $item['itemCaption'] ?? $item['description'] ?? null,
        'category' => detectCategory($item['itemName'] ?? ''),
        'price' => $item['itemPrice'] ?? null,
        'currency' => 'JPY',
        'imageUrl' => $item['imageUrls'][0] ?? $item['mediumImageUrls'][0] ?? null,
        'url' => $item['itemUrl'] ?? $item['url'],
        'source' => $item['source'],
        'status' => detectStatus($item),
        'releaseDate' => $item['releaseDate'] ?? null,
        'tags' => implode(',', detectTags($item['itemName'] ?? '')),
        'affiliateInfo' => json_encode($item['affiliate'] ?? []),
    ];
}
```

### 11.7 ProductRepository::upsert 実装例

```php
class ProductRepository {
    private PDO $pdo;

    public function __construct(PDO $pdo) {
        $this->pdo = $pdo;
    }

    public function upsert(array $product, array $pokemonIds): void {
        $sql = "INSERT INTO products (
            id, name, description, category, price, currency, image_url, url,
            source, status, release_date, tags, affiliate_info, created_at, updated_at
        ) VALUES (
            :id, :name, :description, :category, :price, :currency, :image_url, :url,
            :source, :status, :release_date, :tags, :affiliate_info, :created_at, :updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            category = excluded.category,
            price = excluded.price,
            image_url = excluded.image_url,
            url = excluded.url,
            source = excluded.source,
            status = excluded.status,
            release_date = excluded.release_date,
            tags = excluded.tags,
            affiliate_info = excluded.affiliate_info,
            updated_at = :updated_at";

        $now = date('c');
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':id' => $product['id'],
            ':name' => $product['name'],
            ':description' => $product['description'],
            ':category' => $product['category'],
            ':price' => $product['price'],
            ':currency' => $product['currency'],
            ':image_url' => $product['imageUrl'],
            ':url' => $product['url'],
            ':source' => $product['source'],
            ':status' => $product['status'],
            ':release_date' => $product['releaseDate'],
            ':tags' => $product['tags'],
            ':affiliateInfo' => $product['affiliateInfo'],
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);

        // ポケモン紐付けを更新
        $this->pdo->prepare("DELETE FROM product_pokemon_mappings WHERE product_id = :product_id")
            ->execute([':product_id' => $product['id']]);

        $insert = $this->pdo->prepare("INSERT INTO product_pokemon_mappings (product_id, pokemon_id, priority) VALUES (:product_id, :pokemon_id, 0)");
        foreach (array_unique($pokemonIds) as $pokemonId) {
            $insert->execute([':product_id' => $product['id'], ':pokemon_id' => $pokemonId]);
        }
    }
}
```

### 11.8 ステータス判定ロジック

```php
function detectStatus(array $item): string {
    $stockStatus = strtolower($item['availability'] ?? '');
    $name = strtolower($item['itemName'] ?? '');

    if (str_contains($stockStatus, 'soldout') || str_contains($stockStatus, '売り切れ') || str_contains($stockStatus, 'outofstock')) {
        return 'sold_out';
    }
    if (str_contains($stockStatus, 'preorder') || str_contains($name, '予約')) {
        return 'pre_order';
    }
    if (str_contains($name, '未発売') || str_contains($stockStatus, 'coming_soon')) {
        return 'unreleased';
    }
    if (str_contains($stockStatus, 'discontinued') || str_contains($name, '販売終了')) {
        return 'discontinued';
    }
    return 'available';
}
```

### 11.9 ログ・エラー管理

```sql
CREATE TABLE IF NOT EXISTS crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL, -- success / error / skipped
  message TEXT,
  fetched_count INTEGER,
  inserted_count INTEGER,
  updated_count INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
```

```php
class CrawlerLogger {
    public static function start(PDO $pdo, string $source): int {
        $stmt = $pdo->prepare("INSERT INTO crawl_logs (source, status, message, started_at) VALUES (?, 'running', '', ?)");
        $stmt->execute([$source, date('c')]);
        return (int)$pdo->lastInsertId();
    }

    public static function finish(PDO $pdo, int $logId, int $fetched, int $inserted, int $updated, ?string $message = null): void {
        $stmt = $pdo->prepare("UPDATE crawl_logs SET status='success', message=?, fetched_count=?, inserted_count=?, updated_count=?, finished_at=? WHERE id=?");
        $stmt->execute([$message, $fetched, $inserted, $updated, date('c'), $logId]);
    }

    public static function error(PDO $pdo, int $logId, string $message): void {
        $stmt = $pdo->prepare("UPDATE crawl_logs SET status='error', message=?, finished_at=? WHERE id=?");
        $stmt->execute([$message, date('c'), $logId]);
    }
}
```

### 11.10 レート制限・注意事項

- **各APIの利用規約・レート制限を遵守**する
- スクレイピングは最終手段。robots.txt、利用規約、サイトポリシーを確認
- 取得間隔は対象サイトの負荷を考慮し、1日1回を基本とする
- 取得失敗時は指数バックオフでリトライ（例: 1分後、5分後、15分後）
- 深夜帯（午前2〜4時）に実行すると、サーバー負荷・相手サーバー負荷が低い

### 11.11 手動登録・管理画面

自動取得だけでは網羅できない商品のため、簡易管理画面も用意します。

```text
/pokedex-api/admin/
├── products.php          # 商品一覧・検索
├── product-edit.php      # 商品登録・編集
└── import-csv.php        # CSVインポート
```

認証はベーシック認証 or 簡易トークン認証で保護してください。

## 12. セキュリティ・法務・パフォーマンス上の注意

### セキュリティ

- DB接続情報は `.env` やサーバー環境変数で管理し、GitHub には含めない
- SQLインジェクション対策: PDO のプリペアドステートメントを使用
- `limit` / `offset` に上限を設定し、DoS を防ぐ
- 外部商品URLは入力時にサニタイズ（`javascript:` スキーム等を拒否）
- PHP のエラー表示は本番では無効化し、ログに記録

### 法務・表記

- 商品画像は著作権に注意。公式サイトへのリンクのみを掲載する形が無難
- PR・スポンサードリンクには `rel="sponsored"` を付与
- 価格表記は「参考価格」や税込み/税抜きの明記を徹底
- 未発売・売切商品の表示にはステータスラベルを明確に入れる

### パフォーマンス

- `status`, `release_date`, `pokemon_id` にインデックスを張る
- 商品画像は `loading="lazy"` + 適切な `width/height`
- `limit` はデフォルト 20、最大 100
- 頻繁に呼ばれる API は Nuxt 側でクライアントキャッシュ or SWR を検討

## 13. まとめ

本提案では、**Nuxt 静的サイトをそのまま維持**しつつ、**同じサーバーの別ディレクトリに PHP + SQLite/MySQL の商品API** を配置し、ブラウザから動的に商品情報を取得する構成を採用しています。

- 商品DBには `status` と `release_date` を持たせ、API クエリパラメータでフィルタリング
- フロントエンドは `useProducts()` / `ProductFilter` / `ProductList` でAPIと連携
- お気に入りは `localStorage` でブラウザ内保存
- **PHP 製の cron クローラー**が1日1回各ASP/APIから商品情報を取得し、DBを自動更新

次のステップとして、**まずは Phase 1（API 基盤構築）** を進め、テスト用に数件の商品データを入れて `/pokedex-api/products.php?pokemonId=25` が正しく動作することを確認することを推奨します。
