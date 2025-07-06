# Twitter API 権限エラーの解決方法

## エラー内容
```
detail: 'Your client app is not configured with the appropriate oauth1 app permissions for this endpoint.'
x-access-level: 'read'
```

このエラーは、アプリに書き込み権限が設定されていないことを示しています。

## 解決手順

### 1. Twitter Developer Portalにアクセス
https://developer.twitter.com/en/portal/projects-and-apps

### 2. 該当するアプリを選択
プロジェクト内のアプリをクリック

### 3. User Authentication Settingsを確認
1. アプリの設定画面で「Settings」タブをクリック
2. 「User authentication settings」セクションで「Set up」または「Edit」をクリック

### 4. App permissionsを修正
**重要**: ここが最も重要な設定です
- 現在: `Read` のみ
- 必要: `Read and write`

設定を以下のように変更：
- **App permissions**: `Read and write` を選択
- **Type of App**: `Web App, Automated App or Bot`
- **Callback URI**: `http://localhost:3000/callback`
- **Website URL**: `http://localhost:3000`

### 5. 設定を保存
「Save」ボタンをクリック

### 6. アクセストークンの再生成
**重要**: 権限を変更した後は、新しいアクセストークンを生成する必要があります

1. アプリの「Keys and tokens」タブに移動
2. 「Access Token and Secret」セクションで「Regenerate」をクリック
3. 新しいトークンをコピー
4. `.env`ファイルを更新：
   ```
   TWITTER_ACCESS_TOKEN=新しいアクセストークン
   TWITTER_ACCESS_TOKEN_SECRET=新しいアクセストークンシークレット
   ```

### 7. 設定のテスト
```bash
node test-twitter-api.js --post
```

## 注意事項
- 権限変更後は必ず新しいアクセストークンを生成してください
- 古いトークンは読み取り専用のままです
- アプリの権限はプロジェクト全体ではなく、個別のアプリごとに設定されます