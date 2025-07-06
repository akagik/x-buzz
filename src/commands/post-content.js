import postScheduler from '../scheduling/post-scheduler.js';
import openaiClient from '../api/openai-client.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import logger from '../utils/logger.js';

export default {
  description: 'ネタリストから今日の投稿を決めて投稿',
  usage: 'post-content [--immediate] [--topic="..."] [--style=casual]',
  
  async execute(args = {}) {
    try {
      const { immediate = false, topic = null, style = 'casual' } = args;
      
      const rateCheck = await rateLimiter.checkLimit('post');
      if (!rateCheck.allowed) {
        return {
          success: false,
          message: 'Daily post limit reached',
          resetAt: rateCheck.resetAt,
        };
      }
      
      if (immediate && topic) {
        const content = await openaiClient.generatePost(topic, style);
        const postId = await postScheduler.publishPost(
          await postScheduler.schedulePost(content, new Date()),
        );
        
        return {
          success: true,
          message: 'Content posted immediately',
          postId,
          content,
        };
      }
      
      const postId = await postScheduler.generateAndSchedulePost(topic, style);
      
      if (!postId) {
        return {
          success: false,
          message: 'No suitable content found for posting',
        };
      }
      
      const post = await import('../database/db.js').then((m) => 
        m.default.db.prepare('SELECT * FROM posts WHERE post_id = ?').get(postId),
      );
      
      return {
        success: true,
        message: immediate ? 'Content posted' : 'Content scheduled',
        postId,
        content: post.content,
        scheduledAt: post.scheduled_at,
      };
    } catch (error) {
      logger.error('Error posting content:', error);
      throw error;
    }
  },
};