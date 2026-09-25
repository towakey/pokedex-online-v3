<?php
/**
 * X API v2 クライアント (OAuth 1.0a User Context)
 * composer不要・cURLのみで投稿する
 */

declare(strict_types=1);

class TwitterClient {
    private string $apiKey;
    private string $apiSecret;
    private string $accessToken;
    private string $accessTokenSecret;

    private const API_URL = 'https://api.x.com/2/tweets';

    public function __construct(
        string $apiKey,
        string $apiSecret,
        string $accessToken,
        string $accessTokenSecret
    ) {
        $this->apiKey = $apiKey;
        $this->apiSecret = $apiSecret;
        $this->accessToken = $accessToken;
        $this->accessTokenSecret = $accessTokenSecret;
    }

    /**
     * ツイートを投稿する
     * @return array{success: bool, status: int, detail: string, tweet_id: ?string}
     */
    public function post(string $text): array {
        $body = json_encode(['text' => $text], JSON_UNESCAPED_UNICODE);

        $ch = curl_init(self::API_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Authorization: ' . $this->buildOAuthHeader('POST', self::API_URL),
                'Content-Type: application/json',
            ],
        ]);

        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            return ['success' => false, 'status' => 0, 'detail' => 'cURL error: ' . $curlError, 'tweet_id' => null];
        }

        $decoded = json_decode((string)$response, true);
        $tweetId = $decoded['data']['id'] ?? null;

        return [
            'success' => $status >= 200 && $status < 300 && $tweetId !== null,
            'status' => $status,
            'detail' => mb_strimwidth((string)$response, 0, 500),
            'tweet_id' => $tweetId,
        ];
    }

    /**
     * OAuth 1.0a Authorization ヘッダを生成
     * JSONボディのリクエストでは署名対象パラメータは oauth_* のみ
     */
    private function buildOAuthHeader(string $method, string $url): string {
        $params = [
            'oauth_consumer_key' => $this->apiKey,
            'oauth_nonce' => bin2hex(random_bytes(16)),
            'oauth_signature_method' => 'HMAC-SHA1',
            'oauth_timestamp' => (string)time(),
            'oauth_token' => $this->accessToken,
            'oauth_version' => '1.0',
        ];

        ksort($params);
        $paramString = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
        $baseString = strtoupper($method)
            . '&' . rawurlencode($url)
            . '&' . rawurlencode($paramString);
        $signingKey = rawurlencode($this->apiSecret) . '&' . rawurlencode($this->accessTokenSecret);
        $params['oauth_signature'] = base64_encode(hash_hmac('sha1', $baseString, $signingKey, true));

        $header = 'OAuth ';
        $parts = [];
        foreach ($params as $key => $value) {
            $parts[] = rawurlencode($key) . '="' . rawurlencode($value) . '"';
        }
        return $header . implode(', ', $parts);
    }
}
