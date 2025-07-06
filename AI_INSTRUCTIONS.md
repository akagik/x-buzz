
やはりテストツイートで失敗してしまうようです。

```
node test-twitter-api.js --post
```

現在 basic を設定しています。
以下がログです。


📤 テストツイートを投稿中...

❌ エラーが発生しました:
ApiResponseError: Request failed with code 403
    at RequestHandlerHelper.createResponseError (/Users/kohei/Projects/ai/x-buzz/node_modules/twitter-api-v2/dist/cjs/client-mixins/request-handler.helper.js:104:16)
    at RequestHandlerHelper.onResponseEndHandler (/Users/kohei/Projects/ai/x-buzz/node_modules/twitter-api-v2/dist/cjs/client-mixins/request-handler.helper.js:262:25)
    at Gunzip.emit (node:events:518:28)
    at endReadableNT (node:internal/streams/readable:1698:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  error: true,
  type: 'response',
  code: 403,
  headers: {
    date: 'Sun, 06 Jul 2025 13:37:46 GMT',
    'content-type': 'application/json; charset=utf-8',
    'content-length': '176',
    connection: 'keep-alive',
    perf: '7402827104',
    'set-cookie': [
      'guest_id_marketing=v1%3A175180906661881030; Max-Age=63072000; Expires=Tue, 06 Jul 2027 13:37:46 GMT; Path=/; Domain=.x.com; Secure; SameSite=None',
      'guest_id_ads=v1%3A175180906661881030; Max-Age=63072000; Expires=Tue, 06 Jul 2027 13:37:46 GMT; Path=/; Domain=.x.com; Secure; SameSite=None',
      'personalization_id="v1_dUvysnSG8rtW2jXE2kHFEw=="; Max-Age=63072000; Expires=Tue, 06 Jul 2027 13:37:46 GMT; Path=/; Domain=.x.com; Secure; SameSite=None',
      'guest_id=v1%3A175180906661881030; Max-Age=63072000; Expires=Tue, 06 Jul 2027 13:37:46 GMT; Path=/; Domain=.x.com; Secure; SameSite=None',
      '__cf_bm=.P0lhoPShcvx_WV1zgcw5ysuPM_HYiWJ2EmOrT.yPxU-1751809066-1.0.1.1-dfqbmVM0PNH2i1tpmTu0XG4yViM.T9o0VDe96n3P0icy6qS14eK4TIgN8q.2Dq_lkZEPnMQFp1R883jJQaX4se_MfR7VCx9idaijDmSk6jk; path=/; expires=Sun, 06-Jul-25 14:07:46 GMT; domain=.x.com; HttpOnly; Secure'
    ],
    'api-version': '2.143',
    'cache-control': 'no-cache, no-store, max-age=0',
    'x-access-level': 'read',
    'x-frame-options': 'SAMEORIGIN',
    'content-encoding': 'gzip',
    'x-transaction-id': '48e6dc420ab37c66',
    'x-xss-protection': '0',
    'x-rate-limit-limit': '1080000',
    'x-rate-limit-reset': '1751809165',
    'content-disposition': 'attachment; filename=json.json',
    'x-content-type-options': 'nosniff',
    'x-rate-limit-remaining': '1079998',
    'strict-transport-security': 'max-age=631138519; includeSubdomains',
    'x-response-time': '11',
    'x-connection-hash': 'f8eb6f505be2157a4a4a916e03b19b1dd9b2aa93b87767026578baaa9aa38ec2',
    'cf-cache-status': 'DYNAMIC',
    vary: 'accept-encoding',
    server: 'cloudflare tsa_p',
    'cf-ray': '95af7fa9efb0961d-KIX'
  },
  rateLimit: { limit: 1080000, remaining: 1079998, reset: 1751809165 },
  data: {
    title: 'Forbidden',
    status: 403,
    detail: 'Your client app is not configured with the appropriate oauth1 app permissions for this endpoint.',
    type: 'https://api.twitter.com/2/problems/oauth1-permissions'
  }
}

🚫 アクセス拒否エラーです。以下を確認してください:
   1. アプリの権限設定
   2. アカウントの制限状態
