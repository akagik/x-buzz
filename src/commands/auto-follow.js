import twitterClient from '../api/twitter-client.js';
import openaiClient from '../api/openai-client.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import apiTierManager from '../config/api-tier.js';

export default {
  description: '自動フォロー機能（AIエージェントが判断）',
  usage: 'auto-follow [--limit=5] [--keywords="..."]',
  
  async execute(args = {}) {
    try {
      const { limit = 5, keywords = '' } = args;
      
      // Check if follow actions are available
      if (!apiTierManager.canPerformAction('follow')) {
        return {
          success: false,
          message: 'Auto-follow requires Basic tier or higher',
          currentTier: apiTierManager.getTier(),
          upgradeUrl: 'https://developer.x.com/en/portal/products',
          info: 'The free tier only allows posting tweets. Upgrade to Basic tier for follow functionality.'
        };
      }
      
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
      
      // Get both analyzed and unanalyzed users
      let potentialUsers = db.getPotentialFollowTargets(maxFollows * 2);
      
      // If not enough analyzed users, get unanalyzed ones
      if (potentialUsers.length < maxFollows) {
        const unanalyzedUsers = db.db.prepare(`
          SELECT * FROM users 
          WHERE is_following = 0 
            AND (analysis_result IS NULL OR analysis_result = '')
          ORDER BY CAST(json_extract(metrics, '$.followers_count') AS INTEGER) DESC
          LIMIT ?
        `).all(maxFollows * 2).map(db._parseJsonFields.bind(db));
        
        potentialUsers = [...potentialUsers, ...unanalyzedUsers];
      }
      
      if (potentialUsers.length < maxFollows && keywords) {
        try {
          const searchResults = await twitterClient.searchUsers(keywords, {
            maxResults: 20, // Reduced to avoid timeout
          });
          
          // Check if search returned an error object
          if (searchResults && searchResults.error) {
            logger.warn('User search not available:', searchResults.error);
            return searchResults; // Return the error response
          }
          
          if (Array.isArray(searchResults)) {
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
        } catch (error) {
          logger.error('Error searching users:', error);
          // Continue with existing potential users if search fails
        }
      }
      
      const followed = [];
      let followCount = 0;
      
      for (const user of potentialUsers) {
        if (followCount >= maxFollows) break;
        
        try {
          logger.info(`Analyzing user @${user.username} for follow decision...`);
          
          let analysis = user.analysis_result;
          if (!analysis) {
            // Add timeout for OpenAI analysis
            const analysisPromise = openaiClient.analyzeUser({
              id: user.user_id || user.id,
              username: user.username,
              bio: user.bio || user.description,
              metrics: user.metrics || user.public_metrics,
            });
            
            // 10 second timeout for analysis
            analysis = await Promise.race([
              analysisPromise,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Analysis timeout')), 10000)
              )
            ]);
            
            if (analysis) {
              db.db.prepare(`
                UPDATE users 
                SET analysis_result = @analysis_result, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = @user_id
              `).run({
                user_id: user.user_id || user.id,
                analysis_result: JSON.stringify(analysis),
              });
            }
          }
          
          if (analysis && analysis.should_follow && analysis.follow_score > 0.7) {
            logger.info(`Following @${user.username} (score: ${analysis.follow_score})`);
            
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
            logger.info(`Successfully followed user: @${user.username}`);
          } else {
            logger.info(`Skipped @${user.username} - Score: ${analysis?.follow_score || 'N/A'}`);
          }
        } catch (error) {
          logger.error(`Error processing user ${user.username}:`, error.message);
          // Continue with next user on error
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