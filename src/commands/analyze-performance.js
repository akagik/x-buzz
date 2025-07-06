import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: 'パフォーマンス分析',
  usage: 'analyze-performance [--days=30]',
  
  async execute(args = {}) {
    try {
      const { days = 30 } = args;
      
      const performanceData = db.db.prepare(`
        SELECT 
          COUNT(*) as total_posts,
          AVG(json_extract(metrics, '$.like_count')) as avg_likes,
          AVG(json_extract(metrics, '$.retweet_count')) as avg_retweets,
          AVG(json_extract(metrics, '$.reply_count')) as avg_replies,
          MAX(json_extract(metrics, '$.like_count')) as max_likes,
          MAX(json_extract(metrics, '$.retweet_count')) as max_retweets,
          MIN(json_extract(metrics, '$.like_count')) as min_likes
        FROM posts 
        WHERE status = 'posted' 
          AND posted_at >= datetime('now', '-${days} days')
          AND metrics IS NOT NULL
      `).get();
      
      const hourlyPerformance = db.db.prepare(`
        SELECT 
          strftime('%H', posted_at) as hour,
          COUNT(*) as post_count,
          AVG(json_extract(metrics, '$.like_count')) as avg_likes
        FROM posts 
        WHERE status = 'posted' 
          AND posted_at >= datetime('now', '-${days} days')
          AND metrics IS NOT NULL
        GROUP BY hour
        ORDER BY avg_likes DESC
      `).all();
      
      const topPosts = db.db.prepare(`
        SELECT 
          post_id,
          content,
          metrics,
          posted_at
        FROM posts 
        WHERE status = 'posted' 
          AND posted_at >= datetime('now', '-${days} days')
          AND metrics IS NOT NULL
        ORDER BY json_extract(metrics, '$.like_count') DESC
        LIMIT 5
      `).all().map(db._parseJsonFields);
      
      const engagementByType = db.db.prepare(`
        SELECT 
          interaction_type,
          COUNT(*) as count,
          COUNT(DISTINCT target_id) as unique_targets
        FROM interactions
        WHERE performed_at >= datetime('now', '-${days} days')
        GROUP BY interaction_type
      `).all();
      
      return {
        success: true,
        period: `${days} days`,
        summary: {
          totalPosts: performanceData.total_posts,
          averageLikes: Math.round(performanceData.avg_likes || 0),
          averageRetweets: Math.round(performanceData.avg_retweets || 0),
          averageReplies: Math.round(performanceData.avg_replies || 0),
          maxLikes: performanceData.max_likes || 0,
          maxRetweets: performanceData.max_retweets || 0,
        },
        bestPostingHours: hourlyPerformance.slice(0, 5).map((h) => ({
          hour: `${h.hour}:00`,
          avgLikes: Math.round(h.avg_likes),
          postCount: h.post_count,
        })),
        topPosts: topPosts.map((post) => ({
          id: post.post_id,
          preview: post.content.substring(0, 100) + '...',
          likes: post.metrics.like_count || 0,
          retweets: post.metrics.retweet_count || 0,
          postedAt: post.posted_at,
        })),
        engagementStats: engagementByType,
      };
    } catch (error) {
      logger.error('Error analyzing performance:', error);
      throw error;
    }
  },
};