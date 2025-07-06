import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: 'バイラルコンテンツ検索のテスト（APIを実際に呼ばない）',
  usage: 'search-viral-test [--limit=10]',
  
  async execute(args = {}) {
    try {
      const { limit = 10 } = args;
      
      logger.info('Running search-viral in test mode (no actual API calls)');
      
      // テスト用の仮想バイラルコンテンツデータ
      const mockViralTweets = [
        {
          id: 'test_tweet_viral_1',
          platform: 'twitter',
          text: '【話題】AIが人間の仕事を奪うというけれど、実際はAIを使いこなせる人と使えない人の差が広がるだけだと思う。プログラミングも同じで、AIと協働できるエンジニアが最強。',
          author: { username: 'tech_influencer' },
          public_metrics: {
            like_count: 15420,
            retweet_count: 3856,
            reply_count: 287,
            impression_count: 285000,
            bookmark_count: 1245
          },
          created_at: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'test_tweet_viral_2',
          platform: 'twitter', 
          text: '昨日リリースしたWebサービスが1日で10万PV超えた！やっぱりSNSでバズると一気に広がるね。技術スタックはNext.js + Vercel + Supabase。個人開発でもここまでできる時代。',
          author: { username: 'indie_dev' },
          public_metrics: {
            like_count: 8920,
            retweet_count: 2103,
            reply_count: 156,
            impression_count: 156000,
            bookmark_count: 892
          },
          created_at: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: 'test_tweet_viral_3',
          platform: 'twitter',
          text: 'ChatGPTに「プログラミング初心者が最初に学ぶべき言語は？」と聞いたら「それはあなたが何を作りたいかによります」と返された。正論すぎて何も言えない😂',
          author: { username: 'programming_meme' },
          public_metrics: {
            like_count: 25630,
            retweet_count: 5421,
            reply_count: 412,
            impression_count: 412000,
            bookmark_count: 2156
          },
          created_at: new Date(Date.now() - 10800000).toISOString()
        },
        {
          id: 'test_tweet_viral_4',
          platform: 'twitter',
          text: '【エンジニア転職】未経験から3ヶ月でWeb系企業に内定もらえた勉強法まとめ：1. Progate完走 2. Udemyで実践的な講座 3. 個人プロジェクト3つ作成 4. Qiitaで技術記事10本投稿',
          author: { username: 'career_change' },
          public_metrics: {
            like_count: 12450,
            retweet_count: 4231,
            reply_count: 523,
            impression_count: 234000,
            bookmark_count: 5632
          },
          created_at: new Date(Date.now() - 14400000).toISOString()
        },
        {
          id: 'test_tweet_viral_5',
          platform: 'twitter',
          text: 'Python vs JavaScript論争に終止符を。両方できれば最強です。以上。',
          author: { username: 'dev_wisdom' },
          public_metrics: {
            like_count: 45230,
            retweet_count: 8965,
            reply_count: 1254,
            impression_count: 678000,
            bookmark_count: 3421
          },
          created_at: new Date(Date.now() - 18000000).toISOString()
        }
      ];
      
      // バイラルスコアを計算
      const tweetsWithScores = mockViralTweets.map(tweet => {
        const metrics = tweet.public_metrics;
        const engagementRate = (metrics.like_count + metrics.retweet_count + metrics.reply_count) / 
                             (metrics.impression_count || 1);
        const viralScore = Math.min(100, Math.round(engagementRate * 1000));
        
        return {
          ...tweet,
          engagement_rate: (engagementRate * 100).toFixed(2) + '%',
          viral_score: viralScore
        };
      });
      
      // バイラルスコアでソート
      const sortedTweets = tweetsWithScores.sort((a, b) => b.viral_score - a.viral_score);
      const topTweets = sortedTweets.slice(0, Math.min(limit, sortedTweets.length));
      
      // データベースに保存（テストデータとして）
      for (const tweet of topTweets) {
        const content = {
          content_id: tweet.id,
          platform: tweet.platform,
          content_type: 'tweet',
          content: tweet.text,
          author: tweet.author.username,
          author_id: `test_user_${tweet.author.username}`,
          metrics: {
            ...tweet.public_metrics,
            engagement_rate: tweet.engagement_rate,
            viral_score: tweet.viral_score
          },
          tags: ['test', 'viral', 'mock']
        };
        
        db.saveContent(content);
        logger.info(`[TEST MODE] Saved viral content: ${tweet.id} (score: ${tweet.viral_score})`);
      }
      
      return {
        success: true,
        message: `[TEST MODE] Found ${topTweets.length} viral contents`,
        stats: {
          found: topTweets.length,
          analyzed: topTweets.length,
          platform: 'twitter',
          mode: 'test'
        },
        topContents: topTweets.map(tweet => ({
          id: tweet.id,
          platform: tweet.platform,
          content: tweet.text.substring(0, 100) + '...',
          metrics: tweet.public_metrics,
          viralScore: tweet.viral_score,
          engagementRate: tweet.engagement_rate,
          author: tweet.author.username
        })),
        note: 'This was a test run with mock data. No actual API calls were made.'
      };
    } catch (error) {
      logger.error('Error in search-viral test:', error);
      throw error;
    }
  },
};