import db from '../database/db.js';
import twitterClient from '../api/twitter-client.js';
import openaiClient from '../api/openai-client.js';
import logger from '../utils/logger.js';
import contentManager from '../database/content-manager.js';

class PostScheduler {
  async processScheduledPosts() {
    try {
      const scheduledPosts = db.getScheduledPosts();
      
      for (const post of scheduledPosts) {
        try {
          await this.publishPost(post.post_id);
        } catch (error) {
          logger.error(`Failed to publish post ${post.post_id}:`, error);
        }
      }
      
      logger.info(`Processed ${scheduledPosts.length} scheduled posts`);
    } catch (error) {
      logger.error('Error processing scheduled posts:', error);
      throw error;
    }
  }

  async publishPost(postId) {
    try {
      const post = db.db.prepare('SELECT * FROM posts WHERE post_id = ?').get(postId);
      
      if (!post) {
        throw new Error('Post not found');
      }

      if (post.status === 'posted') {
        logger.warn('Post already published:', postId);
        return;
      }

      const rateLimitStatus = db.getRateLimitStatus('post');
      if (rateLimitStatus.current_count >= rateLimitStatus.daily_limit) {
        logger.warn('Daily post limit reached');
        return;
      }

      const tweet = await twitterClient.postTweet(post.content);

      db.updatePostStatus(postId, 'posted', {
        tweet_id: tweet.id,
        metrics: tweet.public_metrics || {},
      });

      db.incrementRateLimit('post');
      
      db.recordInteraction({
        interaction_type: 'post',
        target_id: tweet.id,
        target_type: 'tweet',
        platform: 'twitter',
        result: { success: true },
      });

      logger.info('Post published successfully:', { postId, tweetId: tweet.id });
      return tweet;
    } catch (error) {
      logger.error('Error publishing post:', error);
      db.updatePostStatus(postId, 'failed');
      throw error;
    }
  }

  async generateAndSchedulePost(topic = null, style = 'casual') {
    try {
      let content;
      
      if (!topic) {
        const viralContents = await contentManager.getViralContents('twitter', 5);
        
        if (viralContents.length > 0) {
          const selectedContent = viralContents[Math.floor(Math.random() * viralContents.length)];
          
          const decision = await openaiClient.decideAction(
            {
              selectedContent,
              currentTime: new Date().toISOString(),
              recentPosts: await this.getRecentPosts(24),
            },
            [
              'create_similar_post',
              'create_inspired_post',
              'create_trending_post',
              'skip',
            ],
          );

          if (decision.action === 'skip') {
            logger.info('AI decided to skip posting');
            return null;
          }

          topic = decision.topic || selectedContent.content;
          style = decision.style || style;
        } else {
          const trends = await twitterClient.getTrendingTopics();
          if (trends.length > 0) {
            topic = trends[0].name;
          }
        }
      }

      if (!topic) {
        logger.warn('No topic found for post generation');
        return null;
      }

      content = await openaiClient.generatePost(topic, style);

      const scheduledTime = await this.determineOptimalPostTime();
      
      const postId = await this.schedulePost(content, scheduledTime);
      
      logger.info('Post generated and scheduled:', { postId, scheduledTime });
      return postId;
    } catch (error) {
      logger.error('Error generating and scheduling post:', error);
      throw error;
    }
  }

  async schedulePost(content, scheduledTime, options = {}) {
    try {
      const scheduler = await import('./scheduler.js');
      return await scheduler.default.schedulePost(content, scheduledTime, options);
    } catch (error) {
      logger.error('Error scheduling post:', error);
      throw error;
    }
  }

  async determineOptimalPostTime() {
    try {
      const performanceData = await this.getPostPerformanceByHour();
      
      const schedule = await openaiClient.optimizeSchedule(
        {
          currentSchedule: db.getSetting('post_schedule_cron'),
          timezone: 'JST',
        },
        performanceData,
      );

      if (schedule.immediatePostTime) {
        return new Date(schedule.immediatePostTime);
      }

      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);

      const optimalHours = schedule.optimalHours || [9, 12, 18, 21];
      const nextOptimalHour = optimalHours.find((hour) => hour > now.getHours());

      if (nextOptimalHour) {
        const optimalTime = new Date(now);
        optimalTime.setHours(nextOptimalHour, Math.floor(Math.random() * 60), 0, 0);
        return optimalTime;
      }

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(optimalHours[0], Math.floor(Math.random() * 60), 0, 0);
      return tomorrow;
    } catch (error) {
      logger.error('Error determining optimal post time:', error);
      
      const now = new Date();
      const delay = 30 + Math.floor(Math.random() * 30);
      return new Date(now.getTime() + delay * 60 * 1000);
    }
  }

  async getRecentPosts(hours = 24) {
    try {
      const stmt = db.db.prepare(`
        SELECT * FROM posts 
        WHERE posted_at >= datetime('now', '-${hours} hours')
          AND status = 'posted'
        ORDER BY posted_at DESC
      `);

      return stmt.all().map(db._parseJsonFields);
    } catch (error) {
      logger.error('Error getting recent posts:', error);
      return [];
    }
  }

  async getPostPerformanceByHour() {
    try {
      const stmt = db.db.prepare(`
        SELECT 
          strftime('%H', posted_at) as hour,
          AVG(json_extract(metrics, '$.like_count')) as avg_likes,
          AVG(json_extract(metrics, '$.retweet_count')) as avg_retweets,
          AVG(json_extract(metrics, '$.reply_count')) as avg_replies,
          COUNT(*) as post_count
        FROM posts 
        WHERE status = 'posted' 
          AND posted_at >= datetime('now', '-30 days')
          AND metrics IS NOT NULL
        GROUP BY hour
        ORDER BY hour
      `);

      return stmt.all();
    } catch (error) {
      logger.error('Error getting post performance by hour:', error);
      return [];
    }
  }

  async rescheduleFailedPosts() {
    try {
      const stmt = db.db.prepare(`
        SELECT * FROM posts 
        WHERE status = 'failed' 
          AND created_at >= datetime('now', '-24 hours')
        ORDER BY created_at DESC
        LIMIT 10
      `);

      const failedPosts = stmt.all();
      const rescheduled = [];

      for (const post of failedPosts) {
        try {
          const newTime = await this.determineOptimalPostTime();
          
          db.updatePostStatus(post.post_id, 'scheduled');
          
          const updateStmt = db.db.prepare(`
            UPDATE posts 
            SET scheduled_at = @scheduled_at, updated_at = CURRENT_TIMESTAMP
            WHERE post_id = @post_id
          `);
          
          updateStmt.run({
            post_id: post.post_id,
            scheduled_at: newTime.toISOString(),
          });

          rescheduled.push(post.post_id);
          logger.info('Rescheduled failed post:', { postId: post.post_id, newTime });
        } catch (error) {
          logger.error(`Failed to reschedule post ${post.post_id}:`, error);
        }
      }

      return rescheduled;
    } catch (error) {
      logger.error('Error rescheduling failed posts:', error);
      throw error;
    }
  }
}

export default new PostScheduler();