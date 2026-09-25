<?php
/**
 * cron実行用 ツイート投稿スクリプト
 *
 * さくらのレンタルサーバー cron 設定例 (5分毎):
 *   cd /home/kyosserver/www/pokedex-online/twitter-bot && php tweet.php
 *
 * CLI専用。ブラウザからは実行不可 (.htaccess でも拒否済み)。
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('This script is CLI only.');
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/ScheduleStore.php';
require_once __DIR__ . '/lib/TwitterClient.php';

function out(string $msg): void {
    echo '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
}

// 二重実行防止ロック
$lockFile = TWITTER_BOT_DATA_DIR . '/tweet.lock';
if (!is_dir(TWITTER_BOT_DATA_DIR)) {
    mkdir(TWITTER_BOT_DATA_DIR, 0755, true);
}
$lock = fopen($lockFile, 'c');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    out('Another instance is running. Skip.');
    exit(0);
}

if (!twitterApiConfigured()) {
    out('ERROR: X API keys are not configured in .env');
    exit(1);
}

$store = new ScheduleStore(TWITTER_BOT_DB_PATH);
$client = new TwitterClient(
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET
);

$due = $store->dueSchedules(new DateTime());
if (count($due) === 0) {
    out('No due schedules.');
    exit(0);
}

out(count($due) . ' due schedule(s) found.');

foreach ($due as $schedule) {
    $result = $client->post($schedule['text']);
    $store->markAttempt((int)$schedule['id'], $schedule['type'], $result['success']);
    $store->log(
        (int)$schedule['id'],
        $schedule['text'],
        'cron',
        $result['success'],
        'HTTP ' . $result['status'] . ' ' . $result['detail']
    );

    if ($result['success']) {
        out("Posted schedule #{$schedule['id']} (tweet id: {$result['tweet_id']})");
    }
    else {
        out("FAILED schedule #{$schedule['id']}: HTTP {$result['status']} {$result['detail']}");
    }

    // レートリミット対策で連続投稿は1秒間隔
    usleep(1000000);
}

flock($lock, LOCK_UN);
fclose($lock);
