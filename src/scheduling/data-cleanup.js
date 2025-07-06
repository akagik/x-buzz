import db from '../database/db.js';
import logger from '../utils/logger.js';

class DataCleanup {
  async cleanupOldData() {
    try {
      logger.info('Starting data cleanup...');
      
      const results = {
        logs: await this.cleanupLogs(),
        interactions: await this.cleanupInteractions(),
        contents: await this.cleanupOldContents(),
      };
      
      logger.info('Data cleanup completed:', results);
      return results;
    } catch (error) {
      logger.error('Error in data cleanup:', error);
      throw error;
    }
  }

  async cleanupLogs() {
    try {
      // Keep only last 30 days of logs
      const result = db.db.prepare(`
        DELETE FROM logs 
        WHERE created_at < datetime('now', '-30 days')
      `).run();
      
      return {
        deleted: result.changes,
        message: `Deleted ${result.changes} old log entries`,
      };
    } catch (error) {
      logger.error('Error cleaning up logs:', error);
      return { deleted: 0, error: error.message };
    }
  }

  async cleanupInteractions() {
    try {
      // Keep only last 90 days of interactions
      const result = db.db.prepare(`
        DELETE FROM interactions 
        WHERE performed_at < datetime('now', '-90 days')
      `).run();
      
      return {
        deleted: result.changes,
        message: `Deleted ${result.changes} old interaction records`,
      };
    } catch (error) {
      logger.error('Error cleaning up interactions:', error);
      return { deleted: 0, error: error.message };
    }
  }

  async cleanupOldContents() {
    try {
      // Delete unanalyzed contents older than 7 days
      const unanalyzedResult = db.db.prepare(`
        DELETE FROM contents 
        WHERE analyzed = 0 
          AND created_at < datetime('now', '-7 days')
      `).run();
      
      // Delete low-performing analyzed contents older than 30 days
      const lowPerformingResult = db.db.prepare(`
        DELETE FROM contents 
        WHERE analyzed = 1 
          AND json_extract(metrics, '$.viral_score') < 10
          AND created_at < datetime('now', '-30 days')
      `).run();
      
      return {
        deletedUnanalyzed: unanalyzedResult.changes,
        deletedLowPerforming: lowPerformingResult.changes,
        message: `Deleted ${unanalyzedResult.changes + lowPerformingResult.changes} old content entries`,
      };
    } catch (error) {
      logger.error('Error cleaning up contents:', error);
      return { deleted: 0, error: error.message };
    }
  }

  async archiveOldPosts() {
    try {
      // This could be extended to archive old posts to a separate table
      // For now, we'll just mark very old posts
      const result = db.db.prepare(`
        UPDATE posts 
        SET status = 'archived'
        WHERE status = 'posted' 
          AND posted_at < datetime('now', '-180 days')
      `).run();
      
      return {
        archived: result.changes,
        message: `Archived ${result.changes} old posts`,
      };
    } catch (error) {
      logger.error('Error archiving posts:', error);
      return { archived: 0, error: error.message };
    }
  }

  async optimizeDatabase() {
    try {
      // Vacuum the database to reclaim space
      db.db.exec('VACUUM');
      
      // Analyze tables for query optimization
      db.db.exec('ANALYZE');
      
      return {
        success: true,
        message: 'Database optimized',
      };
    } catch (error) {
      logger.error('Error optimizing database:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new DataCleanup();