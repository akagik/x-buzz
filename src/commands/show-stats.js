import db from '../database/db.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import logger from '../utils/logger.js';

export default {
  description: 'システム統計情報の表示',
  usage: 'show-stats',
  
  async execute(args = {}) {
    try {
      const dbStats = db.getStats();
      
      const rateLimitStatus = await rateLimiter.getStatus();
      
      const performanceStats = db.db.prepare(`
        SELECT 
          COUNT(*) as total_posts,
          AVG(json_extract(metrics, '$.like_count')) as avg_likes,
          AVG(json_extract(metrics, '$.retweet_count')) as avg_retweets,
          MAX(json_extract(metrics, '$.like_count')) as max_likes,
          MAX(json_extract(metrics, '$.retweet_count')) as max_retweets
        FROM posts 
        WHERE status = 'posted' AND metrics IS NOT NULL
      `).get();
      
      const recentActivity = db.db.prepare(`
        SELECT 
          interaction_type,
          COUNT(*) as count
        FROM interactions
        WHERE performed_at >= datetime('now', '-24 hours')
        GROUP BY interaction_type
      `).all();
      
      const topContent = db.db.prepare(`
        SELECT 
          content_id,
          platform,
          content,
          metrics
        FROM contents
        WHERE analyzed = 1
        ORDER BY json_extract(metrics, '$.viral_score') DESC
        LIMIT 3
      `).all().map(db._parseJsonFields);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        database: {
          contents: {
            total: dbStats.totalContents,
            analyzed: dbStats.analyzedContents,
            percentage: ((dbStats.analyzedContents / dbStats.totalContents) * 100).toFixed(2) + '%',
          },
          posts: {
            total: dbStats.totalPosts,
            posted: dbStats.postedPosts,
            scheduled: dbStats.scheduledPosts,
          },
          users: {
            total: dbStats.totalUsers,
            following: dbStats.followingUsers,
          },
          todayInteractions: dbStats.todayInteractions,
        },
        performance: {
          averageLikes: Math.round(performanceStats.avg_likes || 0),
          averageRetweets: Math.round(performanceStats.avg_retweets || 0),
          maxLikes: performanceStats.max_likes || 0,
          maxRetweets: performanceStats.max_retweets || 0,
        },
        rateLimits: Object.entries(rateLimitStatus).map(([action, status]) => ({
          action,
          used: status.used || 0,
          limit: status.limit || 0,
          remaining: status.remaining || 0,
          percentage: status.limit ? ((status.used / status.limit) * 100).toFixed(2) + '%' : '0%',
          resetAt: status.resetAt,
        })),
        recentActivity: recentActivity.reduce((acc, item) => {
          acc[item.interaction_type] = item.count;
          return acc;
        }, {}),
        topViralContent: topContent.map((content) => ({
          id: content.content_id,
          platform: content.platform,
          preview: content.content.substring(0, 100) + '...',
          viralScore: content.metrics?.viral_score || 0,
        })),
      };
    } catch (error) {
      logger.error('Error showing stats:', error);
      throw error;
    }
  },
};