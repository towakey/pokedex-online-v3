# Devin Automation: ポケモンセンターオンライン 新商品 → pokedex-online 商品情報API

このファイルは app.devin.ai の **Automations** に登録するためのプロンプト原稿です。
`---` 区切り以降（「## プロンプト本文」の下）をそのまま Automation の指示文として貼り付けてください。

## 登録手順（app.devin.ai 側）

1. **Settings → Secrets** に以下を登録
   - `POKEDEX_PRODUCTS_API_TOKEN` … `.env.production` の `PRODUCTS_API_TOKEN` と同じ値
2. **Automations → New** で作成
   - Trigger: Schedule（例: 毎日 09:00 JST = `0 0 * * *` UTC）
   - Repository: 不要（リポジトリをクローンする必要はない）
   - Prompt: 下記「プロンプト本文」を貼り付け
3. 初回は手動で Run して、`mode=health` の `last_sync` が更新されることと、
   `https://pokedex-online.jp/pokedex/products/admin.php` に商品が入ることを確認する

## API 仕様メモ（プロンプト内と同じ内容）

- `GET  https://pokedex-online.jp/pokedex/products/products.php?mode=health`
- `POST https://pokedex-online.jp/pokedex/products/products.php`
  - Header: `Authorization: Bearer <token>` / `Content-Type: application/json`
  - Body: `{"products":[{source_id,name,url,image_url,price,release_date,status_label,category,pokemon:[全国図鑑No...]}],"note":"..."}`
  - 1リクエスト最大 500 件。既存 `source_id` は更新、管理画面でロック済みの紐付けは上書きされない

---

## プロンプト本文

あなたはポケモン図鑑サイト pokedex-online.jp のグッズ情報を毎日更新するバッチ担当です。
ポケモンセンターオンラインの「新商品」一覧を取得し、商品ごとに関連するポケモン（全国図鑑No）を判定して、商品情報APIにPOSTしてください。
ユーザーへの質問はできないので、判断に迷ったら本プロンプトの規則に従い、最後にレポートを書いてください。

### 0. 事前準備

- シークレット `POKEDEX_PRODUCTS_API_TOKEN` を環境変数として使います。値をログやレポートに出力しないこと。
- 以下のエンドポイントを使います。
  - API: `https://pokedex-online.jp/pokedex/products/products.php`
  - ポケモン名一覧: `https://pokedex-online.jp/data/index.json`
- まず `curl -s "https://pokedex-online.jp/pokedex/products/products.php?mode=health"` を実行し、`success: true` と `token_configured: true` を確認する。
  どちらかが false / 取得不能ならそれ以上何もせず、その旨をレポートして終了する。

### 1. ポケモン名辞書の作成

- `https://pokedex-online.jp/data/index.json` を取得する。配列の各要素に `dex`（全国図鑑No）と `name`（日本語名）がある。
  同じ `dex` が複数行（フォルム違い）あるので、`name → dex` の辞書を作る（同名は最初の dex を採用）。
- 商品名からポケモンを判定する規則:
  1. 商品名に含まれる日本語名を **最長一致** で探す。ある位置で長い名前がマッチしたら、その範囲に含まれる短い名前は採用しない
     （例: 「ゴースト」がマッチしたら「ゴース」は採用しない。「ピカチュウ」と「ピチュー」は別物）。
  2. 次の接頭辞・接尾辞は取り除いてから照合する: 「メガ」「キョダイマックス」「ダイマックス」「アローラ」「ガラル」「ヒスイ」「パルデア」「色違い」「のすがた」「X」「Y」（例: 「メガカイリュー」→ カイリュー、「アローラロコン」→ ロコン、「メガリザードンX」→ リザードン）。
     ただし「メガヤンマ」「メガニウム」など名前そのものに「メガ」が含まれるものは辞書に正式名として存在するので、辞書一致を優先する。
  3. 「・」「＆」「&」「／」「/」区切りで複数のポケモンが列挙されている場合は全部採用する（例: 「ピカチュウ・プラスル・マイナン」→ 25, 311, 312）。
  4. 次はポケモン名ではないので無視する: 「ポケピース」「モンポケ」「ポケモンカードゲーム」「Pokémon fit」「ポケットモンスター」「ポケモンセンター」「Pokémon Center」「とっくんちゅう」「Soaring Dreams」「Timeless Adventure」等のシリーズ名・地方名（カントー/ジョウト/ホウエン/シンオウ/イッシュ/カロス/アローラ/ガラル/パルデア/ミアレ）。
  5. 判定できない商品（道具モチーフ、シリーズ名だけ、トレーナー名だけ等）は `pokemon: []` として **それでも送信する**（管理画面で手動紐付けできるようにするため）。
  6. 誤爆しそうなときは採用しない（紐付けなしの方が、誤った紐付けより良い）。
     特に一般名詞と同じポケモン名は、文脈が明確にポケモン商品でない限り採用しない。過去の誤爆例: 「プレイヤーズクラブ」の「クラブ」(98)、色名の「ブルー」/「ライトブルー」の「ブルー」(209)。一方「パモ」「ミュウ」「プリン」等はサーモスやぬいぐるみ等ポケモン商品として使われることが多く、その場合は採用してよい。
- 判定は自分で短い Python/Node スクリプトを書いて機械的に行ってよい。

### 2. 新商品一覧の取得（ブラウザを使用）

- 一覧URL: `https://www.pokemoncenter-online.com/search/?prefn1=releaseType&prefv1=1&srule=top-new-product&page=1`
  - `page=2, 3, ...` とページを進め、商品が0件になるか、`N ~ M / 総件数件` の表示で末尾に達するまで取得する。上限は 10 ページ。
- このサイトは Salesforce Commerce Cloud 製で、アクセス時に `wr.pokemoncenter-online.com`（待合室）へリダイレクトされることがある。
  curl では取得できないので **必ずブラウザで開く**。待合室が表示されたらそのまま最大 10 分待つ。10 分経っても一覧が表示されなければ「取得失敗」としてレポートし、API への POST は行わない。
- 各ページで、ブラウザの JavaScript 実行機能を使って商品タイルを抽出する。次のスニペットを使う（2026-10-04 実測で動作確認済みのセレクタ。結果が 0 件ならページ構造を確認して調整すること。取れる情報の定義は変えない）。

```js
(() => {
  const tiles = [...document.querySelectorAll('li.product[data-pid]')];
  const seen = new Set();
  const out = [];
  for (const tile of tiles) {
    const root = tile;
    const link = root.querySelector('.txtBox .txt a, a[href*=".html"]');
    const href = link ? new URL(link.getAttribute('href'), location.origin).href : '';
    const pid = root.getAttribute('data-pid') || (href.match(/\/([^\/]+)\.html/) || [])[1] || '';
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    const nameEl = root.querySelector('.txtBox .txt a');
    const name = (nameEl ? nameEl.textContent : (root.querySelector('img')?.getAttribute('alt') || '')).replace(/\s+/g, ' ').trim();
    const img = root.querySelector('.pho img, img');
    const image = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';
    const priceText = (root.querySelector('.price')?.textContent || '');
    const priceDigits = priceText.replace(/[^0-9]/g, '');
    const labels = [...root.querySelectorAll('.tagList li')].map(e => e.textContent.trim()).filter(Boolean);
    out.push({
      source_id: pid,
      name,
      url: href,
      image_url: image ? new URL(image, location.origin).href : null,
      price: priceDigits ? Number(priceDigits) : null,
      status_label: labels[0] || null
    });
  }
  return JSON.stringify(out);
})()
```

- 取得したデータの必須条件: `source_id`、`name`、`url`（`https://www.pokemoncenter-online.com/` で始まる）。満たさないものは除外する。
- `release_date` は一覧から取れないので `null` でよい（商品ページを個別に開く必要はない）。
- `category` は一覧から判別できれば入れる（例: ぬいぐるみ / 文具 / 生活雑貨）。不明なら省略。
- 全ページ合計の商品数が 10 件未満、または全商品の `name` が空なら抽出に失敗しているとみなし、POST せずにレポートする。

### 3. API への投稿

- 商品配列に手順1で判定した `pokemon`（全国図鑑Noの整数配列、重複なし）を付与する。
- 100 件ずつに分割して POST する。

```bash
curl -s -X POST "https://pokedex-online.jp/pokedex/products/products.php" \
  -H "Authorization: Bearer ${POKEDEX_PRODUCTS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @batch_1.json
```

- body 形式: `{"products":[...], "note":"devin-automation YYYY-MM-DD"}`
- レスポンスの `success: true` と `received / created / updated / skipped` を確認する。`skipped` に項目があれば内容（`error`）をレポートに含める。
- 401 / 503 が返ったらトークン設定の問題なので、再試行せずレポートする。
- POST 後に再度 `?mode=health` を叩き、`last_sync` が今回の実行で更新されていることを確認する。

### 4. レポート

以下を箇条書きで報告する（トークン値は含めない）:

- 取得ページ数・商品総数
- ポケモン紐付けできた商品数 / できなかった商品数（できなかった商品名を最大 20 件列挙）
- 判定に自信がない紐付け（商品名 → 図鑑No）があれば列挙
- API レスポンスの集計（created / updated / skipped）
- 失敗・スキップした場合はその理由（待合室タイムアウト、セレクタ不一致、認証エラー等）
