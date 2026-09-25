# Twitter Bot (X 自動投稿)

さくらのレンタルサーバーの cron で定期ツイートを行う仕組み。
静的生成・アップロード時に `.output/public/twitter-bot/` へ同梱される。

## 構成

| ファイル | 役割 |
|---|---|
| `admin.php` | 隠し管理ページ（ログイン＋予約CRUD＋投稿ログ） |
| `tweet.php` | cron から実行する投稿スクリプト（CLI専用） |
| `config.php` | `.env` 読み込み・認証 |
| `lib/TwitterClient.php` | OAuth 1.0a 署名で `POST /2/tweets` |
| `lib/ScheduleStore.php` | SQLite (`data/queue.db`) アクセス |
| `data/` | 実行時自動生成（DB・ログ・ロック）※gitignore・rsync除外済み |

## X 側の準備

1. developer.x.com で開発者登録 → Project & App 作成
2. App の「User authentication settings」で **Read and write** を有効化
3. 「Keys and tokens」から以下を取得（Access Token は権限設定**後**に再生成すること）
   - API Key / API Key Secret
   - Access Token / Access Token Secret
4. Developer Console でクレジットを購入（従量課金: 投稿 $0.015/件、URL含む投稿は $0.20/件）

## .env の設定

`.env`（ローカル）/ `.env.production`（本番・アップロード時に同梱）に追記:

```
TWITTER_API_KEY=xxxx
TWITTER_API_SECRET=xxxx
TWITTER_ACCESS_TOKEN=xxxx
TWITTER_ACCESS_TOKEN_SECRET=xxxx
TWITTER_ADMIN_USER=xxxx      # 空欄なら TAGS_ADMIN_* を使用
TWITTER_ADMIN_PASS=xxxx
```

## デプロイ

- `generate-static.bat` / `upload-to-server.bat` が `sync-twitter-bot.bat` を呼び
  `.output/public/twitter-bot/` にコピーされる（`.env.production` → `.env` も同梱）
- 管理ページ URL: `https://<ホスト>/<ベースパス>/twitter-bot/admin.php`

## cron 設定（さくらコントロールパネル）

「cron設定」から例えば5分毎に:

```
cd /home/kyosserver/www/pokedex-online/twitter-bot && php tweet.php
```

- 実行される PHP バージョンはサーバーの `php` コマンドに依存する。
  SSH で `php -v` を確認し、必要なら `/usr/local/phpXX/bin/php` 等のフルパスを指定。
- `tweet.php` は「実行時点で予定時刻を過ぎた未投稿分」を投稿するため、
  cron 間隔が予約時刻の精度になる（5分毎なら最大5分遅れ）。
- 繰り返しスケジュールは失敗時でも当日中に再試行しない（翌スロットまで待つ）。
  単発スケジュールは最大3回リトライする。

## 注意

- `data/queue.db`（予約・ログ）はサーバー上で管理される。アップロード時に
  上書きされないよう rsync `--exclude` 済み。scp の full sync でも退避→復元する。
- X API キーは `.env` 経由でサーバーに配置される。`twitter-bot/.htaccess` で
  ブラウザからの直接アクセスは拒否済みだが、`.env` を public リポジトリに
  コミットしないこと。
