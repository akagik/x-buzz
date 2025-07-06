import { config } from 'dotenv';
import { validateConfig } from './src/config/index.js';
import twitterClient from './src/api/twitter-client.js';
import openaiClient from './src/api/openai-client.js';

config();

async function quickTest() {
  console.log('🚀 X-buzz クイックテスト\n');
  
  try {
    // 設定の検証
    console.log('1️⃣ 設定の検証...');
    validateConfig();
    console.log('✅ 設定OK\n');
    
    // Twitter API テスト
    console.log('2️⃣ Twitter API テスト...');
    const user = await twitterClient.getCurrentUser();
    console.log(`✅ 接続成功: @${user.username}`);
    console.log(`   フォロワー: ${user.public_metrics.followers_count}`);
    console.log(`   フォロー中: ${user.public_metrics.following_count}\n`);
    
    // OpenAI API テスト
    console.log('3️⃣ OpenAI API テスト...');
    const testPrompt = await openaiClient.generatePost('APIテスト', 'casual', 100);
    console.log('✅ OpenAI接続成功');
    console.log(`   生成されたテキスト: ${testPrompt.substring(0, 50)}...\n`);
    
    // トレンド取得テスト
    console.log('4️⃣ トレンド取得テスト...');
    const trends = await twitterClient.getTrendingTopics(1); // Japan WOEID
    console.log(`✅ ${trends.length}件のトレンドを取得`);
    if (trends.length > 0) {
      console.log('   上位3件:');
      trends.slice(0, 3).forEach((trend, i) => {
        console.log(`   ${i + 1}. ${trend.name}`);
      });
    }
    
    console.log('\n✨ すべてのAPIが正常に動作しています！');
    console.log('   npm start でX-buzz AI Agentを起動できます。');
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    
    if (error.message.includes('Missing required configuration')) {
      console.error('\n設定エラー: .envファイルを確認してください');
    } else if (error.message.includes('401')) {
      console.error('\n認証エラー: APIキーを確認してください');
    }
  }
}

quickTest();