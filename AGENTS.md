# Pokédex Online v3

## データフロー

画面は `pokedex/` のソースJSONを直接参照しない。`npm run build:data`（`scripts/build-data.ts`）が `generated-data/` に正規化JSONを出力し、画面はそちらを読む。

- サーバー側（SSR/prerender）: `generated-data/` をファイルから直接読む（`serverDataCache` でメモリキャッシュ）
- クライアント側: `/data/*`（nitro publicAssets → `generated-data/`）を fetch

## ソースJSONを編集した場合

```bash
npm run build:data
```

- `npm run dev` 実行中は **devサーバーの再起動が必要**（`serverDataCache` が生成JSONを保持するため。HMRでは反映されない）
- ブラウザ側はリロード推奨（`useAsyncData` のペイロードが残る場合がある）

## 本番向け生成

```bash
generate-static.bat          # build:data + og-cards + generate + 検証
generate-static.bat --skip-data  # generated-data 再構築をスキップ
upload-to-server.bat         # 検証合格後のみアップロード（本番反映は明示承認が必要）
```

- `.env.production` の値で生成・検証される（`scripts/validate-production.ts`）
- `npm run generate` や手動コピーでの公開物作成は避ける

## ローカル確認

- 開発: `npm run dev` → http://localhost:3000
- 生成成果物: `php -S 127.0.0.1:8787 -t .output\public`（PHP APIも動く。XAMPP経由のサブフォルダURLは baseURL `/` 前提のため崩れる）
