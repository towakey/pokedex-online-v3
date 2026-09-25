<?php
/**
 * Twitter Bot 管理ページ - 隠しページ
 * URLを推測されにくいディレクトリに配置し、パスワード認証で保護する
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/ScheduleStore.php';
require_once __DIR__ . '/lib/TwitterClient.php';

$error = '';
$notice = '';

// ログイン処理
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_user'])) {
    if (login((string)$_POST['login_user'], (string)($_POST['login_pass'] ?? ''))) {
        header('Location: admin.php');
        exit;
    }
    $error = 'ユーザー名またはパスワードが違います';
}

// ログアウト
if (isset($_GET['logout'])) {
    logout();
    header('Location: admin.php');
    exit;
}

$loggedIn = isLoggedIn();

// 管理操作 (ログイン済み + CSRF 必須)
$editRow = null;
if ($loggedIn) {
    $store = new ScheduleStore(TWITTER_BOT_DB_PATH);

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
        if (!csrfCheck()) {
            $error = 'CSRFトークンが無効です。ページを再読み込みしてください。';
        }
        else {
            $action = (string)$_POST['action'];
            $id = (int)($_POST['id'] ?? 0);

            if ($action === 'save') {
                $text = trim((string)($_POST['text'] ?? ''));
                $type = $_POST['type'] === 'recurring' ? 'recurring' : 'once';
                $enabled = isset($_POST['enabled']) ? 1 : 0;
                $scheduledAt = null;
                $recurTime = null;
                $recurDays = 'daily';

                if ($text === '') {
                    $error = '投稿内容を入力してください';
                }
                elseif ($type === 'once') {
                    $dt = trim((string)($_POST['scheduled_at'] ?? ''));
                    $parsed = DateTime::createFromFormat('Y-m-d\TH:i', $dt);
                    if ($parsed === false) {
                        $error = '投稿日時を正しく入力してください';
                    }
                    else {
                        $scheduledAt = $parsed->format('Y-m-d H:i');
                    }
                }
                else {
                    $t = trim((string)($_POST['recur_time'] ?? ''));
                    if (!preg_match('/^\d{2}:\d{2}$/', $t)) {
                        $error = '投稿時刻を正しく入力してください';
                    }
                    else {
                        $recurTime = $t;
                        if (isset($_POST['recur_daily'])) {
                            $recurDays = 'daily';
                        }
                        else {
                            $days = array_map('intval', (array)($_POST['recur_days'] ?? []));
                            $days = array_values(array_filter($days, fn($d) => $d >= 0 && $d <= 6));
                            if (count($days) === 0) {
                                $error = '曜日を選択してください（または「毎日」）';
                            }
                            elseif (count($days) === 7) {
                                $recurDays = 'daily';
                            }
                            else {
                                $recurDays = implode(',', $days);
                            }
                        }
                    }
                }

                if ($error === '') {
                    $store->save([
                        'id' => $id ?: null,
                        'text' => $text,
                        'type' => $type,
                        'scheduled_at' => $scheduledAt,
                        'recur_time' => $recurTime,
                        'recur_days' => $recurDays,
                        'enabled' => $enabled,
                    ]);
                    header('Location: admin.php?saved=1');
                    exit;
                }
            }
            elseif ($action === 'delete' && $id > 0) {
                $store->delete($id);
                header('Location: admin.php?deleted=1');
                exit;
            }
            elseif ($action === 'toggle' && $id > 0) {
                $row = $store->find($id);
                if ($row) {
                    $store->setEnabled($id, !(int)$row['enabled']);
                }
                header('Location: admin.php');
                exit;
            }
            elseif (($action === 'post_now' || $action === 'test_post')) {
                if (!twitterApiConfigured()) {
                    $error = 'X APIキーが設定されていません (.env を確認してください)';
                }
                else {
                    $client = new TwitterClient(
                        TWITTER_API_KEY,
                        TWITTER_API_SECRET,
                        TWITTER_ACCESS_TOKEN,
                        TWITTER_ACCESS_TOKEN_SECRET
                    );
                    if ($action === 'post_now' && $id > 0) {
                        $row = $store->find($id);
                        if ($row) {
                            $result = $client->post($row['text']);
                            $store->log($id, $row['text'], 'manual', $result['success'], 'HTTP ' . $result['status'] . ' ' . $result['detail']);
                            if ($result['success']) {
                                if ($row['type'] === 'once') {
                                    $store->markAttempt($id, 'once', true);
                                }
                                header('Location: admin.php?posted=1');
                                exit;
                            }
                            $error = '投稿に失敗しました: HTTP ' . $result['status'] . ' ' . h($result['detail']);
                        }
                    }
                    else {
                        $testText = trim((string)($_POST['test_text'] ?? ''));
                        if ($testText === '') {
                            $error = 'テスト投稿の内容を入力してください';
                        }
                        else {
                            $result = $client->post($testText);
                            $store->log(null, $testText, 'test', $result['success'], 'HTTP ' . $result['status'] . ' ' . $result['detail']);
                            if ($result['success']) {
                                header('Location: admin.php?posted=1');
                                exit;
                            }
                            $error = '投稿に失敗しました: HTTP ' . $result['status'] . ' ' . h($result['detail']);
                        }
                    }
                }
            }
        }
    }

    if (isset($_GET['edit']) && ($row = $store->find((int)$_GET['edit']))) {
        $editRow = $row;
    }

    $schedules = $store->all();
    $logs = $store->recentLogs(50);
}

// 曜日表示
function daysLabel(string $recurDays): string {
    if ($recurDays === 'daily' || $recurDays === '') {
        return '毎日';
    }
    $names = ['日', '月', '火', '水', '木', '金', '土'];
    $labels = [];
    foreach (explode(',', $recurDays) as $d) {
        $labels[] = $names[(int)$d] ?? $d;
    }
    return implode('・', $labels);
}

function statusLabel(string $status): string {
    return match ($status) {
        'pending' => '待機中',
        'posted' => '投稿済み',
        'failed' => '失敗',
        default => $status,
    };
}

function statusColor(string $status): string {
    return match ($status) {
        'pending' => '#f59e0b',
        'posted' => '#10b981',
        'failed' => '#ef4444',
        default => '#6b7280',
    };
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <title>Twitter Bot 管理</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f3f4f6;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1000px; margin: 0 auto; }
        .card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .header h1 { font-size: 1.5rem; color: #333; }
        .btn {
            padding: 10px 20px; border: none; border-radius: 8px; font-size: 0.9rem;
            cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;
            gap: 6px; transition: all 0.2s; color: white;
        }
        .btn-primary { background: #667eea; }
        .btn-primary:hover { background: #5a67d8; }
        .btn-danger { background: #ef4444; }
        .btn-success { background: #10b981; }
        .btn-secondary { background: #6b7280; }
        .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
        .error { background: #fee2e2; color: #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
        .notice { background: #d1fae5; color: #065f46; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
        .warning { background: #fef3c7; color: #92400e; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
        label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: #555; font-weight: 600; }
        input[type="text"], input[type="password"], input[type="datetime-local"], input[type="time"], textarea {
            width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;
            font-size: 0.9rem; font-family: inherit;
        }
        textarea { min-height: 100px; resize: vertical; }
        .form-group { margin-bottom: 16px; }
        .radio-group, .check-group { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .radio-group label, .check-group label { font-weight: normal; margin-bottom: 0; display: inline-flex; gap: 4px; align-items: center; }
        .conditional { padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 0.88rem; vertical-align: top; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 500; color: white; }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .tweet-text { max-width: 320px; white-space: pre-wrap; word-break: break-word; }
        .muted { color: #6b7280; font-size: 0.8rem; }
        .char-count { font-size: 0.8rem; color: #6b7280; text-align: right; margin-top: 4px; }
        .char-count.over { color: #ef4444; font-weight: bold; }
        h2 { font-size: 1.1rem; color: #333; margin-bottom: 16px; }
        .login-box { max-width: 400px; margin: 80px auto; }
        .hidden { display: none; }
        @media (max-width: 768px) {
            table { min-width: 640px; }
            .table-wrap { overflow-x: auto; }
        }
    </style>
</head>
<body>
<div class="container">
<?php if (!$loggedIn): ?>
    <div class="card login-box">
        <h2>Twitter Bot 管理</h2>
        <?php if ($error): ?><div class="error"><?= h($error) ?></div><?php endif; ?>
        <form method="post">
            <div class="form-group">
                <label>ユーザー名</label>
                <input type="text" name="login_user" required autocomplete="username">
            </div>
            <div class="form-group">
                <label>パスワード</label>
                <input type="password" name="login_pass" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">ログイン</button>
        </form>
    </div>
<?php else: ?>
    <div class="card header">
        <h1>Twitter Bot 管理</h1>
        <div>
            <span class="muted" style="margin-right:10px">user: <?= h($_SESSION['twitter_admin_user'] ?? 'admin') ?></span>
            <a href="?logout=1" class="btn btn-secondary btn-sm">ログアウト</a>
        </div>
    </div>

    <?php if ($error): ?><div class="error"><?= $error /* h()済み or 固定文 */ ?></div><?php endif; ?>
    <?php if (isset($_GET['saved'])): ?><div class="notice">スケジュールを保存しました</div><?php endif; ?>
    <?php if (isset($_GET['deleted'])): ?><div class="notice">削除しました</div><?php endif; ?>
    <?php if (isset($_GET['posted'])): ?><div class="notice">投稿しました</div><?php endif; ?>

    <?php if (!twitterApiConfigured()): ?>
    <div class="warning">
        X APIキーが未設定です。.env に TWITTER_API_KEY / TWITTER_API_SECRET /
        TWITTER_ACCESS_TOKEN / TWITTER_ACCESS_TOKEN_SECRET を設定してください。
    </div>
    <?php endif; ?>

    <!-- スケジュール追加/編集フォーム -->
    <div class="card">
        <h2><?= $editRow ? 'スケジュール編集 (#' . (int)$editRow['id'] . ')' : '新規スケジュール' ?></h2>
        <form method="post">
            <input type="hidden" name="csrf" value="<?= h(csrfToken()) ?>">
            <input type="hidden" name="action" value="save">
            <input type="hidden" name="id" value="<?= $editRow ? (int)$editRow['id'] : 0 ?>">

            <div class="form-group">
                <label>投稿内容</label>
                <textarea name="text" id="tweetText" required><?= h($editRow['text'] ?? '') ?></textarea>
                <div class="char-count" id="charCount">0 / 280</div>
            </div>

            <div class="form-group">
                <label>スケジュール種別</label>
                <div class="radio-group">
                    <label><input type="radio" name="type" value="once" <?= (!$editRow || $editRow['type'] === 'once') ? 'checked' : '' ?>> 単発（指定日時に1回）</label>
                    <label><input type="radio" name="type" value="recurring" <?= ($editRow && $editRow['type'] === 'recurring') ? 'checked' : '' ?>> 繰り返し（定時投稿）</label>
                </div>
            </div>

            <div class="conditional" id="onceFields">
                <label>投稿日時</label>
                <input type="datetime-local" name="scheduled_at"
                       value="<?= h($editRow && $editRow['scheduled_at'] ? str_replace(' ', 'T', $editRow['scheduled_at']) : '') ?>">
            </div>

            <div class="conditional hidden" id="recurFields">
                <div class="form-group">
                    <label>投稿時刻</label>
                    <input type="time" name="recur_time" value="<?= h($editRow['recur_time'] ?? '09:00') ?>">
                </div>
                <div class="form-group">
                    <label>曜日</label>
                    <div class="check-group">
                        <?php
                        $curDays = $editRow['recur_days'] ?? 'daily';
                        $isDaily = $curDays === 'daily' || $curDays === '';
                        $daySet = $isDaily ? [] : array_map('intval', explode(',', $curDays));
                        $dayNames = ['日', '月', '火', '水', '木', '金', '土'];
                        ?>
                        <label><input type="checkbox" name="recur_daily" id="recurDaily" <?= $isDaily ? 'checked' : '' ?>> 毎日</label>
                        <?php foreach ($dayNames as $i => $name): ?>
                        <label class="day-check"><input type="checkbox" name="recur_days[]" value="<?= $i ?>" <?= in_array($i, $daySet, true) ? 'checked' : '' ?>> <?= $name ?></label>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label class="check-group"><input type="checkbox" name="enabled" <?= (!$editRow || (int)$editRow['enabled']) ? 'checked' : '' ?>> 有効にする</label>
            </div>

            <div class="actions">
                <button type="submit" class="btn btn-primary"><?= $editRow ? '更新' : '登録' ?></button>
                <?php if ($editRow): ?><a href="admin.php" class="btn btn-secondary">キャンセル</a><?php endif; ?>
            </div>
        </form>
    </div>

    <!-- スケジュール一覧 -->
    <div class="card">
        <h2>スケジュール一覧</h2>
        <?php if (count($schedules) === 0): ?>
            <p class="muted">登録されているスケジュールはありません</p>
        <?php else: ?>
        <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>ID</th><th>内容</th><th>種別</th><th>予定</th><th>状態</th><th>最終投稿</th><th>操作</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($schedules as $s): ?>
                <tr style="<?= (int)$s['enabled'] ? '' : 'opacity:0.5' ?>">
                    <td><?= (int)$s['id'] ?></td>
                    <td class="tweet-text"><?= h(mb_strimwidth($s['text'], 0, 120, '…')) ?></td>
                    <td><?= $s['type'] === 'once' ? '単発' : '繰り返し' ?></td>
                    <td>
                        <?php if ($s['type'] === 'once'): ?>
                            <?= h($s['scheduled_at']) ?>
                        <?php else: ?>
                            <?= h(daysLabel($s['recur_days'])) ?> <?= h($s['recur_time']) ?>
                        <?php endif; ?>
                        <?php if (!(int)$s['enabled']): ?><br><span class="muted">無効</span><?php endif; ?>
                    </td>
                    <td><span class="status-badge" style="background:<?= statusColor($s['status']) ?>"><?= statusLabel($s['status']) ?></span>
                        <?php if ((int)$s['attempts'] > 0): ?><br><span class="muted">試行<?= (int)$s['attempts'] ?>回</span><?php endif; ?>
                    </td>
                    <td class="muted"><?= h($s['last_posted_at'] ?? '-') ?></td>
                    <td>
                        <div class="actions">
                            <a href="?edit=<?= (int)$s['id'] ?>" class="btn btn-secondary btn-sm">編集</a>
                            <form method="post" style="display:inline">
                                <input type="hidden" name="csrf" value="<?= h(csrfToken()) ?>">
                                <input type="hidden" name="action" value="toggle">
                                <input type="hidden" name="id" value="<?= (int)$s['id'] ?>">
                                <button class="btn btn-secondary btn-sm"><?= (int)$s['enabled'] ? '無効化' : '有効化' ?></button>
                            </form>
                            <form method="post" style="display:inline">
                                <input type="hidden" name="csrf" value="<?= h(csrfToken()) ?>">
                                <input type="hidden" name="action" value="post_now">
                                <input type="hidden" name="id" value="<?= (int)$s['id'] ?>">
                                <button class="btn btn-success btn-sm" onclick="return confirm('今すぐ投稿しますか？')">今すぐ投稿</button>
                            </form>
                            <form method="post" style="display:inline">
                                <input type="hidden" name="csrf" value="<?= h(csrfToken()) ?>">
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="id" value="<?= (int)$s['id'] ?>">
                                <button class="btn btn-danger btn-sm" onclick="return confirm('削除しますか？')">削除</button>
                            </form>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        </div>
        <?php endif; ?>
    </div>

    <!-- 接続テスト -->
    <div class="card">
        <h2>テスト投稿</h2>
        <form method="post">
            <input type="hidden" name="csrf" value="<?= h(csrfToken()) ?>">
            <input type="hidden" name="action" value="test_post">
            <div class="form-group">
                <textarea name="test_text" placeholder="APIキーの動作確認用。今すぐ投稿されます" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary" onclick="return confirm('今すぐ投稿しますか？')">テスト投稿を実行</button>
        </form>
    </div>

    <!-- 投稿ログ -->
    <div class="card">
        <h2>投稿ログ (最新50件)</h2>
        <?php if (count($logs) === 0): ?>
            <p class="muted">ログはありません</p>
        <?php else: ?>
        <div class="table-wrap">
        <table>
            <thead><tr><th>日時</th><th>スケジュール</th><th>内容</th><th>契機</th><th>結果</th><th>詳細</th></tr></thead>
            <tbody>
            <?php foreach ($logs as $log): ?>
                <tr>
                    <td class="muted"><?= h($log['created_at']) ?></td>
                    <td><?= $log['schedule_id'] !== null ? '#' . (int)$log['schedule_id'] : '-' ?></td>
                    <td class="tweet-text"><?= h(mb_strimwidth($log['text'], 0, 80, '…')) ?></td>
                    <td><?= h($log['trigger_type']) ?></td>
                    <td><span class="status-badge" style="background:<?= $log['result'] === 'success' ? '#10b981' : '#ef4444' ?>"><?= h($log['result']) ?></span></td>
                    <td class="muted" style="max-width:260px;word-break:break-all"><?= h($log['detail']) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        </div>
        <?php endif; ?>
    </div>
<?php endif; ?>
</div>

<script>
(function () {
    // X の文字数カウント (簡易): URL=23、全角系=2、その他=1
    function weightedLength(text) {
        var urlRe = /https?:\/\/\S+/g;
        var len = 0, last = 0, m;
        while ((m = urlRe.exec(text)) !== null) {
            len += segmentLength(text.slice(last, m.index)) + 23;
            last = m.index + m[0].length;
        }
        return len + segmentLength(text.slice(last));
    }
    function segmentLength(s) {
        var n = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.codePointAt(i);
            if (c > 0xFFFF) i++;
            n += (c >= 0x1100 && c <= 0x11FF) || (c >= 0x2E80 && c <= 0xA4FF) ||
                 (c >= 0xAC00 && c <= 0xD7AF) || (c >= 0xF900 && c <= 0xFAFF) ||
                 (c >= 0xFE30 && c <= 0xFE6F) || (c >= 0xFF00 && c <= 0xFF60) ||
                 (c >= 0xFFE0 && c <= 0xFFE6) || c > 0xFFFF ? 2 : 1;
        }
        return n;
    }

    var ta = document.getElementById('tweetText');
    var cc = document.getElementById('charCount');
    function update() {
        var n = weightedLength(ta.value);
        cc.textContent = n + ' / 280';
        cc.classList.toggle('over', n > 280);
    }
    if (ta && cc) {
        ta.addEventListener('input', update);
        update();
    }

    // 種別に応じた入力欄の切替
    var radios = document.querySelectorAll('input[name="type"]');
    var onceF = document.getElementById('onceFields');
    var recurF = document.getElementById('recurFields');
    function toggleType() {
        var v = document.querySelector('input[name="type"]:checked');
        var isOnce = !v || v.value === 'once';
        onceF.classList.toggle('hidden', !isOnce);
        recurF.classList.toggle('hidden', isOnce);
    }
    radios.forEach(function (r) { r.addEventListener('change', toggleType); });
    toggleType();

    // 「毎日」チェック時は曜日個別を無効化
    var daily = document.getElementById('recurDaily');
    var dayChecks = document.querySelectorAll('.day-check input');
    function toggleDays() {
        dayChecks.forEach(function (c) { c.disabled = daily.checked; });
    }
    if (daily) {
        daily.addEventListener('change', toggleDays);
        toggleDays();
    }
})();
</script>
</body>
</html>
