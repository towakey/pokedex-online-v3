# Pokédex Online v3

Nuxt を使って構築する、完全静的なポケモン図鑑アプリです。

## 特徴

- `towakey/pokedex` を読み取り専用のデータソースとして利用
- `scripts/build-data.ts` で Web 向け JSON を生成
- `generated-data` を `/data` として配信
- `nuxt generate` により Apache へそのまま配置可能な静的サイトを生成

## セットアップ

```bash
npm install
npm run setup
npm run build:data
npm run generate
```

## 開発時

```bash
npm run dev
```

## 主なディレクトリ

```text
scripts/
  setup.ts
  build-data.ts
nuxt/
  components/
  composables/
  pages/
generated-data/
```

## データフロー

```text
pokedex repo
  -> build-data script
  -> generated-data
  -> static Nuxt site
```

## 補足

- `pokedex` リポジトリの元 JSON は変更しません
- `generated-data` はビルド時に再生成されます
- 実データ構造に揺れがある可能性を考慮し、変換処理は複数の JSON 形状を吸収する実装にしています
