import { RateLimiterMemory } from 'rate-limiter-flexible';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class RateLimiter {
  constructor() {
    this.limiters = new Map();
    this.initialize();
  }

  initialize() {
    this.setupLimiters();
    this.loadLimitsFromConfig();
    logger.info('Rate limiter initialized');
  }

  setupLimiters() {
    const limits = {
      post: config.rateLimits.dailyPostLimit,
      follow: config.rateLimits.dailyFollowLimit,
      like: config.rateLimits.dailyLikeLimit,
      api_twitter: 300, // Twitter API v2 rate limits
      api_openai: 60, // OpenAI API calls per minute
    };

    for (const [action, limit] of Object.entries(limits)) {
      const duration = action.startsWith('api_') ? 60 : 86400; // 1 minute for API, 24 hours for actions
      
      this.limiters.set(action, new RateLimiterMemory({
        points: limit,
        duration: duration,
        blockDuration: 0,
      }));
    }
  }

  loadLimitsFromConfig() {
    const customLimits = [
      { action: 'post', key: 'daily_post_limit' },
      { action: 'follow', key: 'daily_follow_limit' },
      { action: 'like', key: 'daily_like_limit' },
    ];

    for (const { action, key } of customLimits) {
      const value = db.getSetting(key);
      if (value) {
        const limiter = this.limiters.get(action);
        if (limiter) {
          limiter.points = parseInt(value, 10);
        }
      }
    }
  }

  async checkLimit(action, identifier = 'default') {
    try {
      const limiter = this.limiters.get(action);
      if (!limiter) {
        logger.warn(`No rate limiter configured for action: ${action}`);
        return { allowed: true, remaining: Infinity };
      }

      const dbStatus = db.getRateLimitStatus(action);
      
      if (dbStatus.current_count >= dbStatus.daily_limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: dbStatus.reset_at,
          reason: 'Daily limit reached',
        };
      }

      const key = `${action}:${identifier}`;
      const result = await limiter.get(key);
      
      return {
        allowed: true,
        remaining: limiter.points - (result ? result.consumedPoints : 0),
        resetAt: dbStatus.reset_at,
      };
    } catch (error) {
      logger.error(`Error checking rate limit for ${action}:`, error);
      return { allowed: true, remaining: 0 };
    }
  }

  async consume(action, identifier = 'default', points = 1) {
    try {
      const check = await this.checkLimit(action, identifier);
      if (!check.allowed) {
        throw new Error(`Rate limit exceeded for ${action}: ${check.reason}`);
      }

      const limiter = this.limiters.get(action);
      if (!limiter) {
        return true;
      }

      const key = `${action}:${identifier}`;
      await limiter.consume(key, points);

      if (!action.startsWith('api_')) {
        db.incrementRateLimit(action);
      }

      logger.debug(`Consumed ${points} points for ${action}`);
      return true;
    } catch (error) {
      if (error.remainingPoints !== undefined) {
        logger.warn(`Rate limit hit for ${action}: ${error.remainingPoints} points remaining`);
        throw new Error(`Rate limit exceeded for ${action}`);
      }
      
      logger.error(`Error consuming rate limit for ${action}:`, error);
      throw error;
    }
  }

  async reset(action, identifier = 'default') {
    try {
      const limiter = this.limiters.get(action);
      if (!limiter) {
        return;
      }

      const key = `${action}:${identifier}`;
      await limiter.delete(key);

      if (!action.startsWith('api_')) {
        db.resetRateLimit(action);
      }

      logger.info(`Reset rate limit for ${action}`);
    } catch (error) {
      logger.error(`Error resetting rate limit for ${action}:`, error);
    }
  }

  async getStatus(action = null) {
    try {
      if (action) {
        return await this.getActionStatus(action);
      }

      const status = {};
      for (const [actionName] of this.limiters) {
        status[actionName] = await this.getActionStatus(actionName);
      }
      
      return status;
    } catch (error) {
      logger.error('Error getting rate limit status:', error);
      return {};
    }
  }

  async getActionStatus(action) {
    try {
      const limiter = this.limiters.get(action);
      if (!limiter) {
        return { error: 'Unknown action' };
      }

      const dbStatus = db.getRateLimitStatus(action);
      const memoryStatus = await limiter.get(`${action}:default`);

      return {
        action,
        limit: dbStatus.daily_limit,
        used: dbStatus.current_count,
        remaining: dbStatus.daily_limit - dbStatus.current_count,
        resetAt: dbStatus.reset_at,
        memoryUsed: memoryStatus ? memoryStatus.consumedPoints : 0,
        isBlocked: dbStatus.current_count >= dbStatus.daily_limit,
      };
    } catch (error) {
      logger.error(`Error getting status for ${action}:`, error);
      return { error: error.message };
    }
  }

  updateLimit(action, newLimit) {
    try {
      const limiter = this.limiters.get(action);
      if (!limiter) {
        throw new Error(`Unknown action: ${action}`);
      }

      limiter.points = newLimit;

      const settingKey = `daily_${action}_limit`;
      db.updateSetting(settingKey, String(newLimit));

      logger.info(`Updated rate limit for ${action} to ${newLimit}`);
      return true;
    } catch (error) {
      logger.error(`Error updating rate limit for ${action}:`, error);
      throw error;
    }
  }

  async waitForAvailability(action, identifier = 'default') {
    try {
      const check = await this.checkLimit(action, identifier);
      
      if (check.allowed) {
        return 0;
      }

      const resetTime = new Date(check.resetAt).getTime();
      const now = Date.now();
      const waitTime = Math.max(0, resetTime - now);

      logger.info(`Waiting ${waitTime}ms for ${action} rate limit to reset`);
      
      return waitTime;
    } catch (error) {
      logger.error(`Error checking availability for ${action}:`, error);
      return 0;
    }
  }

  async executeWithRateLimit(action, fn, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const identifier = options.identifier || 'default';
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.consume(action, identifier);
        return await fn();
      } catch (error) {
        if (error.message.includes('Rate limit exceeded')) {
          attempt++;
          
          if (attempt >= maxRetries) {
            throw error;
          }

          const waitTime = await this.waitForAvailability(action, identifier);
          
          if (waitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        } else {
          throw error;
        }
      }
    }
  }
}

export default new RateLimiter();