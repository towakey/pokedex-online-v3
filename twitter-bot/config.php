<?php
/**
 * Twitter Bot 設定ファイル
 * .envファイルから認証情報・APIキーを読み込む
 */

declare(strict_types=1);

date_default_timezone_set('Asia/Tokyo');

// .envファイルを読み込む
function loadEnvFile(string $path): array {
    $env = [];
    if (file_exists($path)) {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $env[trim($key)] = trim(trim($value), " \t\n\r\0\x0B\"'");
            }
        }
    }
    return $env;
}

// .env の探索順:
//   1. このディレクトリ内 (アップロード時に同梱される場合)
//   2. プロジェクトルート (ローカル開発用)
//   3. サイトルートの親 (既存タグ管理と同じサーバー配置)
$env = [];
foreach ([
    __DIR__ . '/.env',
    dirname(__DIR__) . '/.env',
    dirname(__DIR__, 2) . '/.env',
] as $envPath) {
    if (file_exists($envPath)) {
        $env = array_merge(loadEnvFile($envPath), $env);
    }
}

// X API 認証情報 (OAuth 1.0a)
define('TWITTER_API_KEY', $env['TWITTER_API_KEY'] ?? '');
define('TWITTER_API_SECRET', $env['TWITTER_API_SECRET'] ?? '');
define('TWITTER_ACCESS_TOKEN', $env['TWITTER_ACCESS_TOKEN'] ?? '');
define('TWITTER_ACCESS_TOKEN_SECRET', $env['TWITTER_ACCESS_TOKEN_SECRET'] ?? '');

// 管理画面の認証情報 (空欄時はタグ管理と同じものを使う)
$twitterAdminUser = $env['TWITTER_ADMIN_USER'] ?? '';
if ($twitterAdminUser === '') {
    $twitterAdminUser = $env['TAGS_ADMIN_USER'] ?? 'admin';
}
$twitterAdminPass = $env['TWITTER_ADMIN_PASS'] ?? '';
if ($twitterAdminPass === '') {
    $twitterAdminPass = $env['TAGS_ADMIN_PASS'] ?? 'password';
}
define('TWITTER_ADMIN_USER', $twitterAdminUser);
define('TWITTER_ADMIN_PASS', $twitterAdminPass);

// データ保存ディレクトリ (SQLite DB・ログ・ロックファイル)
define('TWITTER_BOT_DATA_DIR', __DIR__ . '/data');
define('TWITTER_BOT_DB_PATH', TWITTER_BOT_DATA_DIR . '/queue.db');

// APIキーが揃っているか
function twitterApiConfigured(): bool {
    return TWITTER_API_KEY !== ''
        && TWITTER_API_SECRET !== ''
        && TWITTER_ACCESS_TOKEN !== ''
        && TWITTER_ACCESS_TOKEN_SECRET !== '';
}

// セッション設定
function initSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

// ログイン状態チェック
function isLoggedIn(): bool {
    initSession();
    return isset($_SESSION['twitter_admin_logged_in']) && $_SESSION['twitter_admin_logged_in'] === true;
}

// ログイン処理
function login(string $user, string $pass): bool {
    if ($user === TWITTER_ADMIN_USER && $pass === TWITTER_ADMIN_PASS) {
        initSession();
        session_regenerate_id(true);
        $_SESSION['twitter_admin_logged_in'] = true;
        $_SESSION['twitter_admin_user'] = $user;
        return true;
    }
    return false;
}

// ログアウト処理
function logout(): void {
    initSession();
    session_destroy();
}

// CSRFトークン
function csrfToken(): string {
    initSession();
    if (empty($_SESSION['twitter_admin_csrf'])) {
        $_SESSION['twitter_admin_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['twitter_admin_csrf'];
}

function csrfCheck(): bool {
    initSession();
    return isset($_POST['csrf'], $_SESSION['twitter_admin_csrf'])
        && hash_equals($_SESSION['twitter_admin_csrf'], (string)$_POST['csrf']);
}

// HTMLエスケープ
function h(?string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
