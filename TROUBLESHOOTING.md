# トラブルシューティング記録

## npm install時のエラーと解決方法

### 発生した問題

1. **better-sqlite3のビルドエラー**
   - **症状**: `npm install`実行時にbetter-sqlite3のネイティブモジュールビルドが失敗
   - **原因**: Python 3.12で`distutils`モジュールが削除されたため、node-gypがビルドに失敗
   - **解決方法**: `pip3 install setuptools`を実行してdistutilsの代替を提供

2. **RateLimiterの初期化エラー**
   - **症状**: `TypeError: Cannot read properties of null (reading 'prepare')`
   - **原因**: RateLimiterがモジュールインポート時に初期化され、データベース初期化前にDBアクセスを試みていた
   - **解決方法**: 
     - RateLimiterのコンストラクタから`initialize()`呼び出しを削除
     - AIBuzzAgentの初期化処理でDB初期化後に`rateLimiter.initialize()`を追加

3. **cron-parserのインポートエラー**
   - **症状**: `cron.parseExpression is not a function`
   - **原因**: node-cronパッケージにはparseExpressionメソッドが存在しない
   - **解決方法**:
     - `npm install cron-parser`を実行
     - `import parser from 'cron-parser'`でインポート
     - `parser.parseExpression()`を使用

4. **Schedulerの初期化順序問題**
   - **症状**: `No handler found for task: post_content`
   - **原因**: DBからスケジュールを読み込む際、タスクハンドラーがまだ登録されていなかった
   - **解決方法**: `initialize()`メソッドで`setupDefaultSchedules()`を`loadSchedulesFromDb()`より先に実行

5. **OpenAI API JSONレスポンスエラー**
   - **症状**: `'messages' must contain the word 'json' in some form`
   - **原因**: `response_format: { type: 'json_object' }`使用時、プロンプトに「JSON」の文字が必要
   - **解決方法**: システムプロンプトとユーザープロンプトに「JSON形式で応答してください」を追加

### 教訓

1. **モジュールの初期化タイミング**
   - グローバルなインスタンス化（`export default new Class()`）は避ける
   - 依存関係のある初期化は明示的に順序を制御する

2. **Python環境の互換性**
   - Python 3.12以降では`distutils`が削除されているため、`setuptools`のインストールが必要

3. **外部APIの要件**
   - OpenAI APIのようなサービスは特定のフォーマット要件があるため、ドキュメントを確認する

4. **エラーハンドリング**
   - データベースアクセスメソッドでは、DBが初期化されているかチェックする
   - より具体的なエラーメッセージを提供する