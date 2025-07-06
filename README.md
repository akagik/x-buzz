# X-buzz: AI-powered Social Media Automation Agent

X-buzzは、X（Twitter）での自動投稿とエンゲージメントを最適化するAI駆動のソーシャルメディア自動化エージェントです。

## 主な機能

- **AI駆動の意思決定**: OpenAI APIを使用した自律的な判断
- **自動投稿**: 過去のバズった投稿を分析し、最適なタイミングで投稿
- **スマートエンゲージメント**: AIが判断する自動フォロー・いいね機能
- **コンテンツ管理**: 複数のSNSからバズったコンテンツを収集・管理
- **スケジューリング**: 投稿の自動スケジューリング
- **レート制限管理**: APIレート制限に準拠した安全な操作
- **Webインターフェース**: ブラウザから操作可能な管理画面

## プロジェクト構造

```
x-buzz/
├── src/
│   ├── agents/         # AIエージェントロジック
│   ├── api/           # API統合（OpenAI、X/Twitter）
│   ├── commands/      # コマンドハンドラー
│   ├── config/        # 設定管理
│   ├── database/      # データストレージ
│   ├── scheduling/    # スケジューリングシステム
│   ├── rate-limiting/ # レート制限管理
│   ├── web/          # Webインターフェース
│   └── utils/        # ユーティリティ関数
├── data/             # データ保存
├── logs/             # ログファイル
└── tests/            # テストファイル
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`をコピーして`.env`を作成し、必要なAPIキーを設定します：

```bash
cp .env.example .env
```

#### OpenAI APIキーの取得

1. https://platform.openai.com にアクセス
2. サインアップまたはログイン
3. 右上のアカウントメニューから「API keys」を選択
4. 「Create new secret key」をクリック
5. キーをコピーして`.env`の`OPENAI_API_KEY`に設定

#### X (Twitter) API v2キーの取得

1. **Developer Portalへアクセス**
   - https://developer.twitter.com にアクセス
   - Twitterアカウントでログイン

2. **開発者アカウントの申請**（未登録の場合）
   - 「Sign up」から開発者アカウントを申請
   - 使用目的を英語で記入（例：「Building an AI-powered social media automation tool for personal use」）
   - 承認を待つ（通常数分〜数時間）

3. **プロジェクトとアプリの作成**
   - Developer Portalで「+ Create Project」をクリック
   - プロジェクト名を入力（例：「X-buzz AI Agent」）
   - アプリ名を入力（例：「x-buzz-app」）
   - 「Complete」をクリック

4. **APIキーの取得**
   - アプリ作成後、以下のキーが表示されます：
     - **API Key** → `.env`の`TWITTER_API_KEY`に設定
     - **API Key Secret** → `.env`の`TWITTER_API_SECRET`に設定
   - これらは一度しか表示されないので必ず保存してください

5. **アクセストークンの生成**
   - アプリの設定ページで「Keys and tokens」タブを開く
   - 「Access Token and Secret」セクションで「Generate」をクリック
   - 以下を取得：
     - **Access Token** → `.env`の`TWITTER_ACCESS_TOKEN`に設定
     - **Access Token Secret** → `.env`の`TWITTER_ACCESS_TOKEN_SECRET`に設定

6. **Bearer Tokenの取得**（オプション）
   - 「Keys and tokens」タブの「Bearer Token」セクション
   - 「Generate」をクリック
   - **Bearer Token** → `.env`の`TWITTER_BEARER_TOKEN`に設定

7. **アプリの権限設定**
   - 「Settings」タブ → 「User authentication settings」で「Set up」をクリック
   - **App permissions**を「Read and write」に設定
   - **Type of App**を「Web App, Automated App or Bot」に設定
   - **Callback URI**に`http://localhost:3000/callback`を入力（使用しない場合でも必要）
   - **Website URL**に任意のURL（例：`http://localhost:3000`）を入力
   - 「Save」をクリック

#### .envファイルの設定例

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# X (Twitter) API Configuration
TWITTER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_TOKEN_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_BEARER_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Web UI Configuration (ブラウザから管理画面を使う場合)
WEB_UI_ENABLED=true

# Twitter API Tier Configuration
# 'free', 'basic', 'pro', 'enterprise' のいずれかを設定
# デフォルトは 'free' (無料プラン)
TWITTER_API_TIER=free

# その他の設定はデフォルト値のままでOK
```

### 3. APIキーのテスト

設定が正しいか確認するため、テストスクリプトを実行：

```bash
# 基本的な接続テスト
node test-twitter-api.js

# テストツイートも投稿する場合
node test-twitter-api.js --post

# プロジェクト全体の設定をテスト
node quick-test.js
```

### 4. 起動

テストが成功したら、アプリケーションを起動：

```bash
npm start
```

開発モードで起動する場合：

```bash
npm run dev
```

### 5. Web UIへのアクセス

Web UIを有効にするには、`.env`ファイルに以下を追加してください：

```bash
WEB_UI_ENABLED=true
```

設定後、アプリケーションを起動してブラウザで http://localhost:3000 にアクセスすると、管理ダッシュボードが表示されます。

#### Web UIの機能

- **統計情報の表示**: コンテンツ数、投稿数、フォロー数などをリアルタイムで確認
- **レート制限の監視**: 各種アクションの使用状況を視覚的に確認
- **コマンドの実行**: ボタンクリックで各種コマンドを実行
  - バズコンテンツ検索
  - 投稿作成
  - スケジュール表示
  - 自動フォロー
  - 自動いいね
  - 詳細統計
- **アクティビティログ**: 最近のシステム動作を確認

注意: Web UIはデフォルトでは無効になっています。セキュリティのため、本番環境では適切なアクセス制御を設定することを推奨します。

## Twitter API アクセスレベルについて

### 無料プラン (Free Tier) の制限事項

2025年現在、Twitter API v2の無料プランでは以下の制限があります：

**利用可能な機能:**
- ✅ ツイートの投稿 (POST /2/tweets)
- ✅ メディアアップロード (2025年3月31日まで)
- ✅ OAuth認証

**利用できない機能:**
- ❌ ツイートの検索
- ❌ ユーザーの検索
- ❌ タイムラインの取得
- ❌ フォロー/フォロー解除
- ❌ いいね/いいね解除
- ❌ トレンドの取得
- ❌ ユーザー情報の取得

### 有料プランへのアップグレード

全機能を利用するには、**Basic tier ($100/月)** 以上へのアップグレードが必要です。

アップグレード方法：
1. [Twitter Developer Portal](https://developer.x.com/en/portal/products) にアクセス
2. 「Products」から「X API」を選択
3. 「Basic」または上位プランを選択して購入

### 無料プランでの利用方法

無料プランでは、AI生成コンテンツを使用した自動投稿のみが可能です：

```bash
# 環境変数で無料プランを明示的に設定（デフォルト）
TWITTER_API_TIER=free

# AI生成コンテンツで投稿を作成
npm start
```

システムは自動的に無料プランを検出し、利用可能な機能のみを使用します。

## 使用方法

### コマンド一覧

- **search-viral**: バズったコンテンツを検索
- **post-content**: コンテンツを投稿
- **show-content-list**: 保存されたコンテンツ一覧を表示
- **show-schedule**: 投稿スケジュールを表示
- **search-users**: ユーザーを検索
- **auto-follow**: 自動フォロー（AIが判断）
- **auto-like**: 自動いいね
- **analyze-performance**: パフォーマンス分析
- **update-settings**: 設定の更新
- **show-stats**: 統計情報の表示

### API エンドポイント

- `GET /api/stats` - システム統計情報
- `GET /api/commands` - 利用可能なコマンド一覧
- `POST /api/commands/:name` - コマンドの実行
- `GET /api/rate-limits` - レート制限の状態
- `GET /api/schedules` - スケジュール一覧

## 設定項目

### レート制限

- `DAILY_POST_LIMIT`: 1日の投稿数上限（デフォルト: 10）
- `DAILY_FOLLOW_LIMIT`: 1日のフォロー数上限（デフォルト: 50）
- `DAILY_LIKE_LIMIT`: 1日のいいね数上限（デフォルト: 100）

### スケジュール

- `POST_SCHEDULE_CRON`: 投稿スケジュール（cron形式）
- `CONTENT_SEARCH_CRON`: コンテンツ検索スケジュール（cron形式）

## トラブルシューティング

### APIキー関連のエラー

- **「Missing required configuration」エラー**
  - `.env`ファイルが正しく作成されているか確認
  - 必須のAPIキーがすべて設定されているか確認

- **Twitter API認証エラー**
  - アプリの権限が「Read and write」になっているか確認
  - アクセストークンを再生成してみる
  - APIキーに余分なスペースが含まれていないか確認

- **レート制限エラー**
  - Twitter API v2の制限：
    - 投稿: 200件/15分（ユーザー認証）
    - いいね: 1000件/24時間
    - フォロー: 400件/24時間
  - アプリ内でさらに厳しい制限を設定しています

## 注意事項

- X (Twitter) APIの利用規約を遵守してください
- レート制限を超えないよう注意してください
- 自動化の使用は各プラットフォームの規約に従ってください
- APIキーは絶対に公開リポジトリにコミットしないでください

## ライセンス

MIT