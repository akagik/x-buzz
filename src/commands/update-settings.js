import db from '../database/db.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import scheduler from '../scheduling/scheduler.js';
import logger from '../utils/logger.js';

export default {
  description: '設定の更新',
  usage: 'update-settings --key=value [--category=general]',
  
  async execute(args = {}) {
    try {
      const { key, value, category = 'general' } = args;
      
      if (!key || value === undefined) {
        return {
          success: false,
          error: 'Key and value are required',
        };
      }
      
      // Update database setting
      db.updateSetting(key, String(value));
      
      // Apply setting changes based on key
      const applied = await this.applySettingChange(key, value);
      
      return {
        success: true,
        setting: {
          key,
          value: String(value),
          category,
          applied,
        },
      };
    } catch (error) {
      logger.error('Error updating settings:', error);
      throw error;
    }
  },
  
  async applySettingChange(key, value) {
    const applied = [];
    
    // Rate limit settings
    if (key === 'daily_post_limit') {
      rateLimiter.updateLimit('post', parseInt(value));
      applied.push('Updated post rate limit');
    } else if (key === 'daily_follow_limit') {
      rateLimiter.updateLimit('follow', parseInt(value));
      applied.push('Updated follow rate limit');
    } else if (key === 'daily_like_limit') {
      rateLimiter.updateLimit('like', parseInt(value));
      applied.push('Updated like rate limit');
    }
    
    // Schedule settings
    else if (key === 'post_schedule_cron') {
      scheduler.scheduleTask('post_content', value);
      applied.push('Updated post schedule');
    } else if (key === 'content_search_cron') {
      scheduler.scheduleTask('search_content', value);
      applied.push('Updated content search schedule');
    }
    
    return applied;
  },
};