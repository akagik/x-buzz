# Twitter API v2 対応とフリープラン制限への対応

## 変更内容のまとめ

### 1. API Tierマネージャーの追加 (`src/config/api-tier.js`)
- Twitter APIのアクセスレベル（free, basic, pro, enterprise）を管理
- 各tierで利用可能な機能を定義
- APIアクセス前に権限をチェックする仕組みを実装

### 2. Twitter APIクライアントの更新 (`src/api/twitter-client.js`)
- すべての読み取り操作（search, getUserTimeline, followなど）に権限チェックを追加
- 403エラーを適切にハンドリングし、ユーザーフレンドリーなメッセージを返す
- v1.1 APIからv2 APIへの移行（getTrendingTopicsメソッドの変更）

### 3. フリープラン用コンテンツ生成サービス (`src/services/free-tier-content.js`)
- APIアクセスができない場合のフォールバック機能
- OpenAI APIを使用してコンテンツを生成
- 生成したコンテンツをデータベースに保存

### 4. コマンドの更新
- `search-viral-content.js`: フリープランではAI生成コンテンツを使用
- `auto-follow.js`: フリープランでは利用不可メッセージを表示
- `auto-like.js`: フリープランでは利用不可メッセージを表示

### 5. 設定ファイルの更新
- `.env`: `TWITTER_API_TIER=free` を追加
- `src/config/index.js`: apiTier設定を追加

### 6. README.mdの更新
- Twitter APIアクセスレベルについての詳細な説明を追加
- フリープランの制限事項を明記
- アップグレード方法を記載

## フリープランで利用可能な機能

- ✅ ツイートの投稿
- ✅ AI生成コンテンツの作成
- ✅ スケジュール管理
- ✅ 統計情報の表示（ローカルデータのみ）
- ✅ Web UI

## フリープランで利用不可な機能

- ❌ Twitter検索
- ❌ ユーザー検索
- ❌ 自動フォロー
- ❌ 自動いいね
- ❌ トレンド取得
- ❌ タイムライン取得

## アップグレードの推奨

全機能を利用するには、Basic tier（$100/月）以上へのアップグレードを推奨します。
アップグレードは https://developer.x.com/en/portal/products から行えます。