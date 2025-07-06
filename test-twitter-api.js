import dotenv from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';

// Load environment variables
dotenv.config();

async function testTwitterAPI() {
  console.log('🔧 Twitter API接続テストを開始します...\n');
  
  try {
    // APIキーの存在確認
    console.log('1️⃣ APIキーの確認...');
    const requiredKeys = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET', 
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET'
    ];
    
    let missingKeys = [];
    for (const key of requiredKeys) {
      if (!process.env[key]) {
        missingKeys.push(key);
      } else {
        console.log(`✅ ${key}: 設定済み`);
      }
    }
    
    if (missingKeys.length > 0) {
      console.error('\n❌ エラー: 以下のキーが設定されていません:');
      missingKeys.forEach(key => console.error(`   - ${key}`));
      return;
    }
    
    console.log('\n2️⃣ Twitter APIクライアントの作成...');
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    });
    
    const v2Client = client.v2;
    console.log('✅ クライアント作成成功\n');
    
    // 認証ユーザー情報の取得
    console.log('3️⃣ 認証ユーザー情報の取得...');
    const me = await v2Client.me({
      'user.fields': ['name', 'username', 'public_metrics', 'description', 'created_at']
    });
    
    console.log('✅ 認証成功！\n');
    console.log('👤 ユーザー情報:');
    console.log(`   名前: ${me.data.name}`);
    console.log(`   ユーザー名: @${me.data.username}`);
    console.log(`   ID: ${me.data.id}`);
    console.log(`   フォロワー: ${me.data.public_metrics.followers_count}`);
    console.log(`   フォロー中: ${me.data.public_metrics.following_count}`);
    console.log(`   ツイート数: ${me.data.public_metrics.tweet_count}`);
    
    // 最新のツイートを取得してみる
    console.log('\n4️⃣ 最新のツイートを取得...');
    const timeline = await v2Client.userTimeline(me.data.id, {
      max_results: 5,
      'tweet.fields': ['created_at', 'public_metrics']
    });
    
    const tweets = [];
    for await (const tweet of timeline) {
      tweets.push(tweet);
    }
    
    console.log(`✅ ${tweets.length}件のツイートを取得\n`);
    
    if (tweets.length > 0) {
      console.log('📝 最新のツイート:');
      tweets.slice(0, 3).forEach((tweet, index) => {
        console.log(`\n[${index + 1}] ${tweet.text.substring(0, 50)}...`);
        console.log(`   ❤️  ${tweet.public_metrics?.like_count || 0} | 🔁 ${tweet.public_metrics?.retweet_count || 0}`);
      });
    }
    
    // テストツイートの投稿（オプション）
    console.log('\n5️⃣ テストツイートを投稿しますか？');
    console.log('   投稿する場合は、このスクリプトを以下のように実行してください:');
    console.log('   node test-twitter-api.js --post\n');
    
    if (process.argv.includes('--post')) {
      console.log('📤 テストツイートを投稿中...');
      const testTweet = await v2Client.tweet({
        text: `🤖 X-buzz AI Agent テスト投稿\n\nTwitter API v2接続テスト成功！\n${new Date().toLocaleString('ja-JP')}`
      });
      
      console.log('✅ ツイート投稿成功！');
      console.log(`   Tweet ID: ${testTweet.data.id}`);
      console.log(`   URL: https://twitter.com/${me.data.username}/status/${testTweet.data.id}`);
    }
    
    console.log('\n✨ すべてのテストが成功しました！');
    console.log('   X-buzz AI Agentを開始する準備ができています。');
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error);
    
    if (error.code === 401) {
      console.error('\n🔐 認証エラーです。以下を確認してください:');
      console.error('   1. APIキーが正しくコピーされているか');
      console.error('   2. アプリの権限が "Read and write" に設定されているか');
      console.error('   3. アクセストークンが有効か（再生成が必要かも）');
    } else if (error.code === 403) {
      console.error('\n🚫 アクセス拒否エラーです。以下を確認してください:');
      console.error('   1. アプリの権限設定');
      console.error('   2. アカウントの制限状態');
    } else if (error.code === 429 || error.status === 429) {
      console.error('\n⏳ レート制限エラーです。');
      console.error('\n📊 レート制限の詳細:');
      console.error('   - ツイート投稿: 15分間で50件まで');
      console.error('   - 1日あたり: 300件まで（v2 API）');
      console.error('\n💡 対処法:');
      console.error('   1. 15分以上待ってから再試行してください');
      console.error('   2. レート制限をリセットする時間を確認してください');
      
      // レスポンスヘッダーからレート制限情報を取得
      if (error.headers) {
        const resetTime = error.headers['x-rate-limit-reset'];
        if (resetTime) {
          const resetDate = new Date(parseInt(resetTime) * 1000);
          const now = new Date();
          const waitMinutes = Math.ceil((resetDate - now) / 60000);
          console.error(`\n⏰ レート制限リセット時刻: ${resetDate.toLocaleString('ja-JP')}`);
          console.error(`   約 ${waitMinutes} 分後にリセットされます`);
        }
      }
    }
  }
}

// スクリプトを実行
testTwitterAPI();