<?php
/**
 * 投稿スケジュールの永続化 (SQLite)
 */

declare(strict_types=1);

class ScheduleStore {
    private PDO $pdo;

    public function __construct(string $dbPath) {
        $dir = dirname($dbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        // データディレクトリへの直接アクセスを遮断する .htaccess を自動配置
        $htaccess = $dir . '/.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "Require all denied\n");
        }

        $this->pdo = new PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->exec('PRAGMA journal_mode = WAL');
        $this->initSchema();
    }

    private function initSchema(): void {
        $this->pdo->exec('
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT \'once\',
                scheduled_at TEXT,
                recur_time TEXT,
                recur_days TEXT DEFAULT \'daily\',
                enabled INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT \'pending\',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_attempt_at TEXT,
                last_posted_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime(\'now\', \'localtime\')),
                updated_at TEXT
            )
        ');
        $this->pdo->exec('
            CREATE TABLE IF NOT EXISTS post_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id INTEGER,
                text TEXT NOT NULL,
                trigger_type TEXT NOT NULL DEFAULT \'cron\',
                result TEXT NOT NULL,
                detail TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime(\'now\', \'localtime\'))
            )
        ');
    }

    public function all(): array {
        return $this->pdo->query('SELECT * FROM schedules ORDER BY id DESC')->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM schedules WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function save(array $data): int {
        $now = date('Y-m-d H:i:s');
        if (!empty($data['id'])) {
            $stmt = $this->pdo->prepare('
                UPDATE schedules SET
                    text = :text, type = :type, scheduled_at = :scheduled_at,
                    recur_time = :recur_time, recur_days = :recur_days,
                    enabled = :enabled, updated_at = :updated_at
                WHERE id = :id
            ');
            $stmt->execute([
                ':text' => $data['text'],
                ':type' => $data['type'],
                ':scheduled_at' => $data['scheduled_at'],
                ':recur_time' => $data['recur_time'],
                ':recur_days' => $data['recur_days'],
                ':enabled' => $data['enabled'],
                ':updated_at' => $now,
                ':id' => (int)$data['id'],
            ]);
            return (int)$data['id'];
        }

        $stmt = $this->pdo->prepare('
            INSERT INTO schedules (text, type, scheduled_at, recur_time, recur_days, enabled)
            VALUES (:text, :type, :scheduled_at, :recur_time, :recur_days, :enabled)
        ');
        $stmt->execute([
            ':text' => $data['text'],
            ':type' => $data['type'],
            ':scheduled_at' => $data['scheduled_at'],
            ':recur_time' => $data['recur_time'],
            ':recur_days' => $data['recur_days'],
            ':enabled' => $data['enabled'],
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    public function delete(int $id): void {
        $this->pdo->prepare('DELETE FROM schedules WHERE id = :id')->execute([':id' => $id]);
    }

    public function setEnabled(int $id, bool $enabled): void {
        $this->pdo->prepare('UPDATE schedules SET enabled = :e WHERE id = :id')
            ->execute([':e' => $enabled ? 1 : 0, ':id' => $id]);
    }

    /**
     * cron実行時点で投稿期限が来ているレコードを返す
     */
    public function dueSchedules(DateTime $now): array {
        $due = [];
        $today = $now->format('Y-m-d');
        $nowStr = $now->format('Y-m-d H:i:s');
        $weekday = (int)$now->format('w'); // 0=日 ... 6=土

        foreach ($this->all() as $row) {
            if (!(int)$row['enabled']) {
                continue;
            }

            if ($row['type'] === 'once') {
                // 単発: 予定時刻を過ぎており未投稿・試行3回未満
                if ($row['status'] === 'pending'
                    && $row['scheduled_at'] !== null
                    && $row['scheduled_at'] <= $now->format('Y-m-d H:i')
                    && (int)$row['attempts'] < 3) {
                    $due[] = $row;
                }
            }
            elseif ($row['type'] === 'recurring') {
                // 繰り返し: 該当曜日で当日の予定時刻を過ぎ、当日分まだ未試行
                $days = $row['recur_days'] === 'daily' || $row['recur_days'] === ''
                    ? null
                    : array_map('intval', explode(',', $row['recur_days']));
                if ($days !== null && !in_array($weekday, $days, true)) {
                    continue;
                }
                if ($row['recur_time'] === null || $row['recur_time'] === '') {
                    continue;
                }
                $scheduledToday = $today . ' ' . $row['recur_time'];
                if ($scheduledToday <= $now->format('Y-m-d H:i')
                    && ($row['last_attempt_at'] === null || $row['last_attempt_at'] < $scheduledToday)) {
                    $due[] = $row;
                }
            }
        }
        return $due;
    }

    public function markAttempt(int $id, string $type, bool $success): void {
        $now = date('Y-m-d H:i:s');
        if ($type === 'once') {
            if ($success) {
                $sql = 'UPDATE schedules SET attempts = attempts + 1, last_attempt_at = :now,
                        status = \'posted\', last_posted_at = :now WHERE id = :id';
            }
            else {
                $sql = 'UPDATE schedules SET attempts = attempts + 1, last_attempt_at = :now,
                        status = CASE WHEN attempts + 1 >= 3 THEN \'failed\' ELSE \'pending\' END
                        WHERE id = :id';
            }
        }
        else {
            $sql = $success
                ? 'UPDATE schedules SET last_attempt_at = :now, last_posted_at = :now WHERE id = :id'
                : 'UPDATE schedules SET last_attempt_at = :now WHERE id = :id';
        }
        $this->pdo->prepare($sql)->execute([':now' => $now, ':id' => $id]);
    }

    public function log(?int $scheduleId, string $text, string $trigger, bool $success, string $detail = ''): void {
        $this->pdo->prepare('
            INSERT INTO post_log (schedule_id, text, trigger_type, result, detail)
            VALUES (:sid, :text, :trigger, :result, :detail)
        ')->execute([
            ':sid' => $scheduleId,
            ':text' => $text,
            ':trigger' => $trigger,
            ':result' => $success ? 'success' : 'error',
            ':detail' => $detail,
        ]);
    }

    public function recentLogs(int $limit = 50): array {
        $stmt = $this->pdo->prepare('SELECT * FROM post_log ORDER BY id DESC LIMIT :limit');
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
