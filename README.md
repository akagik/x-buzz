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

以下の項目を設定してください：

- **OpenAI API**: https://platform.openai.com でAPIキーを取得
- **X (Twitter) API**: https://developer.twitter.com でアプリケーションを作成してキーを取得

### 3. 起動

```bash
npm start
```

開発モードで起動する場合：

```bash
npm run dev
```

### 4. Web UIへのアクセス

ブラウザで http://localhost:3000 にアクセスすると、管理画面が表示されます。

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

## 注意事項

- X (Twitter) APIの利用規約を遵守してください
- レート制限を超えないよう注意してください
- 自動化の使用は各プラットフォームの規約に従ってください

## ライセンス

MIT