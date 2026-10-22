# Pokédex Online v3

## データフロー

画面は `pokedex/` のソースJSONを直接参照しない。`npm run build:data`（`scripts/build-data.ts`）が `generated-data/` に正規化JSONを出力し、画面はそちらを読む。

- サーバー側（SSR/prerender）: `generated-data/` をファイルから直接読む（`serverDataCache` でメモリキャッシュ）
- クライアント側: `/data/*`（nitro publicAssets → `generated-data/`）を fetch

### 各ゲームディレクトリの補助JSON

`pokedex/pokedex/<ゲーム名>/` 配下のファイルは `<ゲーム名>.json` の隣に置くと build-data が拾う。

- `evolve.json`: 進化データ → ポケモンJSONの `evolutions`
- `waza.json` / `waza_list.json` / `waza_machine.json`: わざデータ → `movesets` と `generated-data/waza/<slug>.json`
- `encounter.json`: ゲット方法 → ポケモンJSONの `encounters`。`encounter.<地方名>.<全国図鑑No>.{name, methods[]}` 形式で、method は `{type, versions[], locations[], note?}`。versions は `version_mapping` の `name_eng`（red/green等）。地方キーは設定スラッグと一致しなくてよく、全国図鑑Noで地方図鑑内のポケモンに紐付く

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

## PWA / Service Worker

- `public/sw.js`: precache（`/`・manifest・アイコン）+ ランタイムキャッシュ（ページHTML=network-first、`/data`・画像・`/_nuxt`=SWR）
- `public/sw.js` のキャッシュ戦略・URL構成を変えたら **`CACHE_VERSION` を上げる**（activate時に旧バージョンのキャッシュが削除される）
- SW登録は `plugins/pwa.client.ts` で本番ビルドのみ（`import.meta.env.PROD`）。devサーバーでは登録されない
- `generate-static.bat` の成果物に含めるため、SW・manifest・アイコンは `public/` 配下に置く（`.output/public` にそのままコピーされる）

## 商品情報API（グッズ情報）

- API: `pokedex/products/products.php`。GET `?no=全国図鑑No` でポケモン別の商品、`?mode=recent` で新着商品、`?mode=health` で稼働状態を取得できる。POST は `Authorization: Bearer $PRODUCTS_API_TOKEN` が必要。
- SQLite: `pokedex/products/data/products.db`。`pokedex/.gitignore` と rsync の除外対象で、サーバー側の運用データとして保持する。
- 管理画面: `pokedex/products/admin.php`。認証は `PRODUCTS_ADMIN_*` を使い、未設定なら `TAGS_ADMIN_*` にフォールバックする。管理画面で紐付けを編集すると `links_locked=1` になり、自動同期で上書きされない。
- 商品情報は Devin Automation が投稿する。プロンプト原稿は `.devin/automations/pokemon-center-products.md`。シークレット `POKEDEX_PRODUCTS_API_TOKEN` に `.env.production` の `PRODUCTS_API_TOKEN` と同じ値を設定する。
- 詳細ページは全国図鑑Noを使ってクライアント側で商品APIを fetch するため、商品一覧は静的生成に含まれない。
- ローカル確認（XAMPP）: `http://localhost/pokedex-online-v3/pokedex/products/products.php?mode=health`
