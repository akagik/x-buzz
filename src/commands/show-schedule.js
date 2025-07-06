import scheduler from '../scheduling/scheduler.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: '今の投稿スケジュールの表示',
  usage: 'show-schedule [--upcoming=10]',
  
  async execute(args = {}) {
    try {
      const { upcoming = 10 } = args;
      
      const scheduledPosts = db.db.prepare(`
        SELECT * FROM posts 
        WHERE status = 'scheduled' 
        ORDER BY scheduled_at ASC 
        LIMIT ?
      `).all(upcoming);
      
      const activeTasks = scheduler.getAllTasks();
      
      const schedules = db.db.prepare(`
        SELECT * FROM schedules 
        WHERE is_active = 1
        ORDER BY schedule_type
      `).all();
      
      return {
        success: true,
        scheduledPosts: scheduledPosts.map((post) => ({
          id: post.post_id,
          content: post.content.substring(0, 100) + '...',
          scheduledAt: post.scheduled_at,
          status: post.status,
        })),
        activeTasks: activeTasks.map((task) => ({
          name: task.name,
          isActive: task.status.isActive,
          lastRun: task.status.lastRun,
          nextRun: task.status.nextRun,
          cronExpression: task.status.cronExpression,
        })),
        scheduleSettings: schedules.map((schedule) => ({
          type: schedule.schedule_type,
          cronExpression: schedule.cron_expression,
          lastRun: schedule.last_run,
          nextRun: schedule.next_run,
        })),
        currentTime: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error showing schedule:', error);
      throw error;
    }
  },
};