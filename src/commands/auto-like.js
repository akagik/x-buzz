import twitterClient from '../api/twitter-client.js';
import openaiClient from '../api/openai-client.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import apiTierManager from '../config/api-tier.js';

export default {
  description: '他ユーザーの自動いいね機能',
  usage: 'auto-like [--limit=10] [--strategy=engagement]',
  
  async execute(args = {}) {
    try {
      const { limit = 10, strategy = 'engagement' } = args;
      
      // Check if like actions are available
      if (!apiTierManager.canPerformAction('like')) {
        return {
          success: false,
          message: 'Auto-like requires Basic tier or higher',
          currentTier: apiTierManager.getTier(),
          upgradeUrl: 'https://developer.x.com/en/portal/products',
          info: 'The free tier only allows posting tweets. Upgrade to Basic tier for like functionality.'
        };
      }
      
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
      
      const tweets = await this.getTweetsToLike(strategy, maxLikes * 2);
      
      // Check if getTweetsToLike returned an error
      if (tweets && tweets.error) {
        return tweets;
      }
      
      const liked = [];
      let likeCount = 0;
      
      for (const tweet of tweets) {
        if (likeCount >= maxLikes) break;
        
        try {
          const shouldLike = await this.shouldLikeTweet(tweet, strategy);
          
          if (shouldLike) {
            await rateLimiter.consume('like');
            await twitterClient.likeTweet(tweet.id);
            
            db.recordInteraction({
              interaction_type: 'like',
              target_id: tweet.id,
              target_type: 'tweet',
              platform: 'twitter',
              result: { 
                success: true, 
                strategy,
                metrics: tweet.public_metrics,
              },
            });
            
            liked.push({
              tweetId: tweet.id,
              author: tweet.author?.username || 'unknown',
              content: tweet.text.substring(0, 50) + '...',
              metrics: tweet.public_metrics,
            });
            
            likeCount++;
            logger.info(`Liked tweet: ${tweet.id}`);
          }
        } catch (error) {
          logger.error(`Error liking tweet ${tweet.id}:`, error);
        }
      }
      
      return {
        success: true,
        message: `Liked ${liked.length} tweets`,
        strategy,
        liked,
        remaining: rateCheck.remaining - likeCount,
      };
    } catch (error) {
      logger.error('Error in auto-like:', error);
      throw error;
    }
  },
  
  async getTweetsToLike(strategy, limit) {
    switch (strategy) {
      case 'engagement': {
        const followingUsers = db.db.prepare(`
          SELECT user_id FROM users 
          WHERE is_following = 1 
          ORDER BY RANDOM() 
          LIMIT 10
        `).all();
        
        const tweets = [];
        for (const user of followingUsers) {
          const timeline = await twitterClient.getUserTimeline(user.user_id, {
            maxResults: 5,
          });
          // Skip if error response
          if (timeline && !timeline.error) {
            tweets.push(...timeline);
          }
        }
        
        return tweets.sort((a, b) => 
          (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0),
        ).slice(0, limit);
      }
      
      case 'trending': {
        const trends = await twitterClient.getTrendingTopics();
        // Return error if trends fetch failed
        if (trends && trends.error) {
          return trends;
        }
        
        const tweets = [];
        
        for (const trend of (trends || []).slice(0, 3)) {
          const searchResults = await twitterClient.searchTweets(trend.name, {
            maxResults: 10,
          });
          // Skip if error response
          if (searchResults && !searchResults.error) {
            tweets.push(...searchResults);
          }
        }
        
        return tweets.slice(0, limit);
      }
      
      case 'mutual': {
        const currentUser = await twitterClient.getCurrentUser();
        const followers = await twitterClient.getFollowers(currentUser.id, {
          maxResults: 20,
        });
        
        const tweets = [];
        for (const follower of followers) {
          const timeline = await twitterClient.getUserTimeline(follower.id, {
            maxResults: 2,
          });
          tweets.push(...timeline);
        }
        
        return tweets.slice(0, limit);
      }
      
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  },
  
  async shouldLikeTweet(tweet, strategy) {
    const metrics = tweet.public_metrics || {};
    
    const hasBeenLiked = db.db.prepare(`
      SELECT 1 FROM interactions 
      WHERE interaction_type = 'like' 
        AND target_id = ? 
        AND performed_at > datetime('now', '-7 days')
    `).get(tweet.id);
    
    if (hasBeenLiked) {
      return false;
    }
    
    if (strategy === 'engagement') {
      const engagementRate = (metrics.like_count + metrics.retweet_count) / 
                           (metrics.impression_count || 1);
      return engagementRate > 0.02;
    }
    
    if (strategy === 'trending') {
      return metrics.like_count > 10;
    }
    
    return true;
  },
};