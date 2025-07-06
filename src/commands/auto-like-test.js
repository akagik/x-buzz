import rateLimiter from '../rate-limiting/rate-limiter.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: '自動いいねのテスト（APIを実際に呼ばない）',
  usage: 'auto-like-test [--limit=10]',
  
  async execute(args = {}) {
    try {
      const { limit = 10 } = args;
      
      logger.info('Running auto-like in test mode (no actual API calls)');
      
      // レート制限のチェックのみ実行
      const rateCheck = await rateLimiter.checkLimit('like');
      if (!rateCheck.allowed) {
        return {
          success: false,
          message: 'Daily like limit reached',
          remaining: rateCheck.remaining,
          resetAt: rateCheck.resetAt,
        };
      }
      
      const maxLikes = Math.min(limit, rateCheck.remaining);
      
      // テスト用の仮想ツイートデータ
      const mockTweets = [
        {
          id: 'test_tweet_1',
          text: 'AIの最新技術について解説します。機械学習とディープラーニングの違いとは？',
          author: { username: 'tech_writer' },
          public_metrics: {
            like_count: 150,
            retweet_count: 30,
            reply_count: 10,
            impression_count: 5000
          }
        },
        {
          id: 'test_tweet_2',
          text: 'プログラミング初心者向け：Pythonで始める機械学習入門',
          author: { username: 'python_teacher' },
          public_metrics: {
            like_count: 280,
            retweet_count: 85,
            reply_count: 25,
            impression_count: 8000
          }
        },
        {
          id: 'test_tweet_3',
          text: '最新のAI論文を読んでみた感想。GPT-4の仕組みがようやく理解できた',
          author: { username: 'ai_researcher' },
          public_metrics: {
            like_count: 420,
            retweet_count: 120,
            reply_count: 45,
            impression_count: 12000
          }
        }
      ];
      
      const liked = [];
      let likeCount = 0;
      
      for (const tweet of mockTweets) {
        if (likeCount >= maxLikes) break;
        
        // 既にいいね済みかチェック
        const hasBeenLiked = db.db.prepare(`
          SELECT 1 FROM interactions 
          WHERE interaction_type = 'like' 
            AND target_id = ? 
            AND performed_at > datetime('now', '-7 days')
        `).get(tweet.id);
        
        if (!hasBeenLiked) {
          // エンゲージメント率を計算
          const engagementRate = (tweet.public_metrics.like_count + tweet.public_metrics.retweet_count) / 
                               (tweet.public_metrics.impression_count || 1);
          
          if (engagementRate > 0.02) {
            // 実際のAPIは呼ばずにデータベースに記録
            logger.info(`[TEST MODE] Would like tweet: ${tweet.id} by @${tweet.author.username}`);
            
            await rateLimiter.consume('like');
            
            db.recordInteraction({
              interaction_type: 'like',
              target_id: tweet.id,
              target_type: 'tweet',
              platform: 'twitter',
              result: { 
                success: true, 
                test_mode: true,
                metrics: tweet.public_metrics,
              },
            });
            
            liked.push({
              tweetId: tweet.id,
              author: tweet.author.username,
              content: tweet.text.substring(0, 50) + '...',
              metrics: tweet.public_metrics,
              engagementRate: (engagementRate * 100).toFixed(2) + '%'
            });
            
            likeCount++;
          }
        }
      }
      
      return {
        success: true,
        message: `[TEST MODE] Would have liked ${liked.length} tweets`,
        liked,
        remaining: rateCheck.remaining - likeCount,
        note: 'This was a test run. No actual API calls were made.'
      };
    } catch (error) {
      logger.error('Error in auto-like test:', error);
      throw error;
    }
  },
};