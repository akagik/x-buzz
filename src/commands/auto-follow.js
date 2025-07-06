import twitterClient from '../api/twitter-client.js';
import openaiClient from '../api/openai-client.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: '自動フォロー機能（AIエージェントが判断）',
  usage: 'auto-follow [--limit=5] [--keywords="..."]',
  
  async execute(args = {}) {
    try {
      const { limit = 5, keywords = '' } = args;
      
      const rateCheck = await rateLimiter.checkLimit('follow');
      if (!rateCheck.allowed) {
        return {
          success: false,
          message: 'Daily follow limit reached',
          remaining: rateCheck.remaining,
          resetAt: rateCheck.resetAt,
        };
      }
      
      const maxFollows = Math.min(limit, rateCheck.remaining);
      
      let potentialUsers = db.getPotentialFollowTargets(maxFollows * 2);
      
      if (potentialUsers.length < maxFollows && keywords) {
        const searchResults = await twitterClient.searchUsers(keywords, {
          maxResults: 50,
        });
        
        for (const user of searchResults) {
          db.saveUser({
            user_id: user.id,
            platform: 'twitter',
            username: user.username,
            display_name: user.name,
            bio: user.description,
            metrics: user.public_metrics,
          });
        }
        
        potentialUsers = [...potentialUsers, ...searchResults];
      }
      
      const followed = [];
      let followCount = 0;
      
      for (const user of potentialUsers) {
        if (followCount >= maxFollows) break;
        
        try {
          const analysis = user.analysis_result || await openaiClient.analyzeUser({
            id: user.user_id || user.id,
            username: user.username,
            bio: user.bio || user.description,
            metrics: user.metrics || user.public_metrics,
          });
          
          if (!user.analysis_result) {
            db.db.prepare(`
              UPDATE users 
              SET analysis_result = @analysis_result, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = @user_id
            `).run({
              user_id: user.user_id || user.id,
              analysis_result: JSON.stringify(analysis),
            });
          }
          
          if (analysis.should_follow && analysis.follow_score > 0.7) {
            await rateLimiter.consume('follow');
            await twitterClient.followUser(user.user_id || user.id);
            
            db.updateUserFollowStatus(user.user_id || user.id, true);
            db.recordInteraction({
              interaction_type: 'follow',
              target_id: user.user_id || user.id,
              target_type: 'user',
              platform: 'twitter',
              result: { success: true, analysis },
            });
            
            followed.push({
              userId: user.user_id || user.id,
              username: user.username,
              reason: analysis.follow_reason,
              score: analysis.follow_score,
            });
            
            followCount++;
            logger.info(`Followed user: @${user.username}`);
          }
        } catch (error) {
          logger.error(`Error processing user ${user.username}:`, error);
        }
      }
      
      return {
        success: true,
        message: `Followed ${followed.length} users`,
        followed,
        remaining: rateCheck.remaining - followCount,
      };
    } catch (error) {
      logger.error('Error in auto-follow:', error);
      throw error;
    }
  },
};