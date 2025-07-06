import openaiClient from '../api/openai-client.js';
import twitterClient from '../api/twitter-client.js';
import commandHandler from '../commands/command-handler.js';
import scheduler from '../scheduling/scheduler.js';
import rateLimiter from '../rate-limiting/rate-limiter.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class AIBuzzAgent {
  constructor() {
    this.isRunning = false;
    this.currentState = {
      mode: 'idle',
      lastAction: null,
      lastActionTime: null,
      performance: {},
    };
  }

  async initialize() {
    try {
      logger.info('Initializing AI-buzz agent...');
      
      // Initialize database
      db.initialize();
      
      // Initialize rate limiter after database
      rateLimiter.initialize();
      
      // Register commands with async loading
      await commandHandler.registerDefaultCommands();
      
      // Initialize scheduler
      scheduler.initialize();
      
      // Load current state
      await this.loadState();
      
      logger.info('AI-buzz agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI-buzz agent:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Agent is already running');
      return;
    }

    this.isRunning = true;
    this.currentState.mode = 'active';
    
    logger.info('AI-buzz agent started');
    
    // Start autonomous behavior loop
    this.startAutonomousLoop();
  }

  async stop() {
    this.isRunning = false;
    this.currentState.mode = 'idle';
    
    scheduler.shutdown();
    
    logger.info('AI-buzz agent stopped');
  }

  async startAutonomousLoop() {
    while (this.isRunning) {
      try {
        await this.executeAutonomousAction();
        
        // Wait between actions (5-15 minutes)
        const waitTime = 5 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } catch (error) {
        logger.error('Error in autonomous loop:', error);
        await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute on error
      }
    }
  }

  async executeAutonomousAction() {
    try {
      const currentContext = await this.gatherContext();
      
      const decision = await openaiClient.decideAction(currentContext, [
        'post_content',
        'search_viral_content',
        'engage_with_users',
        'analyze_performance',
        'optimize_strategy',
        'wait',
      ]);

      logger.info('AI decision:', decision);

      switch (decision.action) {
        case 'post_content':
          await this.handlePostContent(decision);
          break;
          
        case 'search_viral_content':
          await this.handleSearchContent(decision);
          break;
          
        case 'engage_with_users':
          await this.handleEngagement(decision);
          break;
          
        case 'analyze_performance':
          await this.handlePerformanceAnalysis(decision);
          break;
          
        case 'optimize_strategy':
          await this.handleStrategyOptimization(decision);
          break;
          
        case 'wait':
        default:
          logger.info('AI decided to wait');
          break;
      }

      this.updateState(decision.action);
    } catch (error) {
      logger.error('Error executing autonomous action:', error);
      throw error;
    }
  }

  async gatherContext() {
    const stats = db.getStats();
    const rateLimits = await rateLimiter.getStatus();
    const recentPosts = await this.getRecentActivity();
    const currentTime = new Date();
    
    return {
      stats,
      rateLimits,
      recentActivity: recentPosts,
      currentTime: currentTime.toISOString(),
      timeOfDay: currentTime.getHours(),
      dayOfWeek: currentTime.getDay(),
      lastAction: this.currentState.lastAction,
      lastActionTime: this.currentState.lastActionTime,
      performance: this.currentState.performance,
    };
  }

  async handlePostContent(decision) {
    try {
      const canPost = await rateLimiter.checkLimit('post');
      
      if (!canPost.allowed) {
        logger.info('Post rate limit reached, skipping');
        return;
      }

      const result = await commandHandler.execute('post-content', {
        topic: decision.topic,
        style: decision.style || 'casual',
        immediate: decision.immediate || false,
      });

      if (result.success) {
        logger.info('Successfully posted content:', result.result.postId);
      }
    } catch (error) {
      logger.error('Error handling post content:', error);
    }
  }

  async handleSearchContent(decision) {
    try {
      const result = await commandHandler.execute('search-viral', {
        platform: decision.platform || 'twitter',
        limit: decision.limit || 50,
      });

      if (result.success) {
        logger.info('Content search completed:', result.result.stats);
      }
    } catch (error) {
      logger.error('Error handling content search:', error);
    }
  }

  async handleEngagement(decision) {
    try {
      const engagementType = decision.engagementType || 'mixed';
      
      if (engagementType === 'follow' || engagementType === 'mixed') {
        const canFollow = await rateLimiter.checkLimit('follow');
        
        if (canFollow.allowed && canFollow.remaining > 0) {
          await commandHandler.execute('auto-follow', {
            limit: Math.min(decision.followLimit || 3, canFollow.remaining),
            keywords: decision.keywords,
          });
        }
      }

      if (engagementType === 'like' || engagementType === 'mixed') {
        const canLike = await rateLimiter.checkLimit('like');
        
        if (canLike.allowed && canLike.remaining > 0) {
          await commandHandler.execute('auto-like', {
            limit: Math.min(decision.likeLimit || 5, canLike.remaining),
            strategy: decision.likeStrategy || 'engagement',
          });
        }
      }
    } catch (error) {
      logger.error('Error handling engagement:', error);
    }
  }

  async handlePerformanceAnalysis(decision) {
    try {
      const result = await commandHandler.execute('analyze-performance');
      
      if (result.success && result.result) {
        this.currentState.performance = result.result;
        logger.info('Performance analysis completed');
      }
    } catch (error) {
      logger.error('Error handling performance analysis:', error);
    }
  }

  async handleStrategyOptimization(decision) {
    try {
      const currentSchedule = scheduler.getAllTasks();
      const performanceData = this.currentState.performance;
      
      const optimization = await openaiClient.optimizeSchedule(
        currentSchedule,
        performanceData,
      );

      if (optimization.newSchedule) {
        for (const task of optimization.newSchedule) {
          scheduler.scheduleTask(task.name, task.cron, null, task.config);
        }
        
        logger.info('Strategy optimized and schedules updated');
      }

      if (optimization.rateLimitAdjustments) {
        for (const [action, limit] of Object.entries(optimization.rateLimitAdjustments)) {
          rateLimiter.updateLimit(action, limit);
        }
        
        logger.info('Rate limits adjusted based on optimization');
      }
    } catch (error) {
      logger.error('Error handling strategy optimization:', error);
    }
  }

  async getRecentActivity() {
    try {
      const recentPosts = db.db.prepare(`
        SELECT * FROM posts 
        WHERE posted_at >= datetime('now', '-24 hours') 
          AND status = 'posted'
        ORDER BY posted_at DESC
        LIMIT 10
      `).all();

      const recentInteractions = db.db.prepare(`
        SELECT interaction_type, COUNT(*) as count
        FROM interactions
        WHERE performed_at >= datetime('now', '-24 hours')
        GROUP BY interaction_type
      `).all();

      return {
        posts: recentPosts,
        interactions: recentInteractions,
      };
    } catch (error) {
      logger.error('Error getting recent activity:', error);
      return { posts: [], interactions: [] };
    }
  }

  updateState(action) {
    this.currentState.lastAction = action;
    this.currentState.lastActionTime = new Date().toISOString();
    
    db.updateSetting('agent_last_action', action);
    db.updateSetting('agent_last_action_time', this.currentState.lastActionTime);
  }

  async loadState() {
    try {
      this.currentState.lastAction = db.getSetting('agent_last_action');
      this.currentState.lastActionTime = db.getSetting('agent_last_action_time');
      
      const performanceData = db.getSetting('agent_performance_data');
      if (performanceData) {
        this.currentState.performance = JSON.parse(performanceData);
      }
    } catch (error) {
      logger.error('Error loading agent state:', error);
    }
  }

  async executeCommand(commandName, args = {}) {
    return await commandHandler.execute(commandName, args, {
      agent: this,
      isAutonomous: false,
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentState: this.currentState,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
    };
  }
}

export default new AIBuzzAgent();