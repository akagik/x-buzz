import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.tasks = new Map();
  }

  initialize() {
    try {
      this.loadSchedulesFromDb();
      this.setupDefaultSchedules();
      logger.info('Scheduler initialized successfully');
    } catch (error) {
      logger.error('Error initializing scheduler:', error);
      throw error;
    }
  }

  loadSchedulesFromDb() {
    const schedules = db.db.prepare('SELECT * FROM schedules WHERE is_active = 1').all();
    
    schedules.forEach((schedule) => {
      const config = schedule.config ? JSON.parse(schedule.config) : {};
      this.scheduleTask(
        schedule.schedule_type,
        schedule.cron_expression,
        this.tasks.get(schedule.schedule_type),
        config,
      );
    });
  }

  setupDefaultSchedules() {
    this.registerTask('post_content', async () => {
      logger.info('Running scheduled post task');
      const postManager = await import('./post-scheduler.js');
      await postManager.default.processScheduledPosts();
    });

    this.registerTask('search_content', async () => {
      logger.info('Running content search task');
      const contentSearcher = await import('./content-searcher.js');
      await contentSearcher.default.searchForViralContent();
    });

    this.registerTask('analyze_performance', async () => {
      logger.info('Running performance analysis task');
      const performanceAnalyzer = await import('./performance-analyzer.js');
      await performanceAnalyzer.default.analyzeRecentPerformance();
    });

    this.registerTask('cleanup_old_data', async () => {
      logger.info('Running data cleanup task');
      const dataCleanup = await import('./data-cleanup.js');
      await dataCleanup.default.cleanupOldData();
    });

    const postCron = db.getSetting('post_schedule_cron') || config.scheduling.postScheduleCron;
    const searchCron = db.getSetting('content_search_cron') || config.scheduling.contentSearchCron;

    this.scheduleTask('post_content', postCron);
    this.scheduleTask('search_content', searchCron);
    this.scheduleTask('analyze_performance', '0 3 * * *'); // Daily at 3 AM
    this.scheduleTask('cleanup_old_data', '0 4 * * 0'); // Weekly on Sunday at 4 AM
  }

  registerTask(name, handler) {
    this.tasks.set(name, handler);
    logger.info(`Task registered: ${name}`);
  }

  scheduleTask(name, cronExpression, handler = null, config = {}) {
    try {
      if (this.jobs.has(name)) {
        this.cancelTask(name);
      }

      const taskHandler = handler || this.tasks.get(name);
      
      if (!taskHandler) {
        throw new Error(`No handler found for task: ${name}`);
      }

      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      const job = cron.schedule(cronExpression, async () => {
        logger.info(`Executing scheduled task: ${name}`);
        try {
          await taskHandler(config);
          this.updateLastRun(name);
        } catch (error) {
          logger.error(`Error executing task ${name}:`, error);
        }
      });

      this.jobs.set(name, job);
      this.saveScheduleToDb(name, cronExpression, config);
      
      logger.info(`Task scheduled: ${name} with cron: ${cronExpression}`);
      return job;
    } catch (error) {
      logger.error(`Error scheduling task ${name}:`, error);
      throw error;
    }
  }

  cancelTask(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      this.updateScheduleStatus(name, false);
      logger.info(`Task cancelled: ${name}`);
    }
  }

  pauseTask(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      logger.info(`Task paused: ${name}`);
    }
  }

  resumeTask(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      logger.info(`Task resumed: ${name}`);
    }
  }

  getTaskStatus(name) {
    const job = this.jobs.get(name);
    if (!job) {
      return { exists: false };
    }

    const schedule = db.db.prepare('SELECT * FROM schedules WHERE schedule_type = ?').get(name);
    
    return {
      exists: true,
      isActive: job.status !== 'stopped',
      lastRun: schedule?.last_run,
      nextRun: schedule?.next_run,
      cronExpression: schedule?.cron_expression,
    };
  }

  getAllTasks() {
    const tasks = [];
    
    for (const [name, job] of this.jobs) {
      tasks.push({
        name,
        status: this.getTaskStatus(name),
      });
    }
    
    return tasks;
  }

  async schedulePost(content, scheduledTime, options = {}) {
    try {
      const postId = uuidv4();
      
      db.savePost({
        post_id: postId,
        content,
        scheduled_at: scheduledTime.toISOString(),
        status: 'scheduled',
        content_source_id: options.contentSourceId || null,
      });

      if (options.immediate) {
        const delay = scheduledTime.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(async () => {
            const postManager = await import('./post-scheduler.js');
            await postManager.default.publishPost(postId);
          }, delay);
        }
      }

      logger.info(`Post scheduled for ${scheduledTime.toISOString()}`);
      return postId;
    } catch (error) {
      logger.error('Error scheduling post:', error);
      throw error;
    }
  }

  saveScheduleToDb(scheduleType, cronExpression, config = {}) {
    const stmt = db.db.prepare(`
      INSERT OR REPLACE INTO schedules 
      (schedule_type, cron_expression, is_active, config, next_run)
      VALUES (@schedule_type, @cron_expression, 1, @config, @next_run)
    `);

    stmt.run({
      schedule_type: scheduleType,
      cron_expression: cronExpression,
      config: JSON.stringify(config),
      next_run: this.getNextRun(cronExpression),
    });
  }

  updateScheduleStatus(scheduleType, isActive) {
    const stmt = db.db.prepare(`
      UPDATE schedules 
      SET is_active = @is_active, updated_at = CURRENT_TIMESTAMP
      WHERE schedule_type = @schedule_type
    `);

    stmt.run({
      schedule_type: scheduleType,
      is_active: isActive ? 1 : 0,
    });
  }

  updateLastRun(scheduleType) {
    const stmt = db.db.prepare(`
      UPDATE schedules 
      SET last_run = CURRENT_TIMESTAMP, 
          next_run = @next_run,
          updated_at = CURRENT_TIMESTAMP
      WHERE schedule_type = @schedule_type
    `);

    const schedule = db.db.prepare('SELECT cron_expression FROM schedules WHERE schedule_type = ?').get(scheduleType);
    
    stmt.run({
      schedule_type: scheduleType,
      next_run: this.getNextRun(schedule.cron_expression),
    });
  }

  getNextRun(cronExpression) {
    const interval = cron.parseExpression(cronExpression);
    return interval.next().toISOString();
  }

  shutdown() {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    
    this.jobs.clear();
    this.tasks.clear();
    logger.info('Scheduler shutdown complete');
  }
}

export default new Scheduler();