import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { schema, indexes } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  initialize() {
    try {
      const dbPath = path.resolve(config.database.path);
      this.db = new Database(dbPath, {
        verbose: config.env === 'development' ? logger.debug : null,
      });

      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this._createTables();
      this._createIndexes();
      this._initializeSettings();

      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Error initializing database:', error);
      throw error;
    }
  }

  _createTables() {
    Object.values(schema).forEach((tableSchema) => {
      this.db.exec(tableSchema);
    });
  }

  _createIndexes() {
    indexes.forEach((indexQuery) => {
      this.db.exec(indexQuery);
    });
  }

  _initializeSettings() {
    const defaultSettings = [
      { key: 'daily_post_limit', value: String(config.rateLimits.dailyPostLimit), category: 'rate_limits' },
      { key: 'daily_follow_limit', value: String(config.rateLimits.dailyFollowLimit), category: 'rate_limits' },
      { key: 'daily_like_limit', value: String(config.rateLimits.dailyLikeLimit), category: 'rate_limits' },
      { key: 'post_schedule_cron', value: config.scheduling.postScheduleCron, category: 'scheduling' },
      { key: 'content_search_cron', value: config.scheduling.contentSearchCron, category: 'scheduling' },
    ];

    const insertSetting = this.db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, category)
      VALUES (@key, @value, @category)
    `);

    defaultSettings.forEach((setting) => {
      insertSetting.run(setting);
    });
  }

  saveContent(content) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contents 
      (content_id, platform, content_type, content, author, author_id, metrics, tags)
      VALUES (@content_id, @platform, @content_type, @content, @author, @author_id, @metrics, @tags)
    `);

    return stmt.run({
      ...content,
      metrics: JSON.stringify(content.metrics || {}),
      tags: JSON.stringify(content.tags || []),
    });
  }

  getUnanalyzedContents(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM contents 
      WHERE analyzed = 0 
      ORDER BY created_at DESC 
      LIMIT ?
    `);

    return stmt.all(limit).map(this._parseJsonFields);
  }

  updateContentAnalysis(contentId, analysisResult) {
    const stmt = this.db.prepare(`
      UPDATE contents 
      SET analyzed = 1, analysis_result = @analysis_result, updated_at = CURRENT_TIMESTAMP
      WHERE content_id = @content_id
    `);

    return stmt.run({
      content_id: contentId,
      analysis_result: JSON.stringify(analysisResult),
    });
  }

  getTopContents(platform = null, limit = 20) {
    let query = `
      SELECT * FROM contents 
      WHERE analyzed = 1 
    `;

    if (platform) {
      query += ` AND platform = ? `;
    }

    query += ` ORDER BY json_extract(metrics, '$.engagement_rate') DESC LIMIT ? `;

    const stmt = this.db.prepare(query);
    const params = platform ? [platform, limit] : [limit];

    return stmt.all(...params).map(this._parseJsonFields);
  }

  savePost(post) {
    const stmt = this.db.prepare(`
      INSERT INTO posts 
      (post_id, content, scheduled_at, status, content_source_id)
      VALUES (@post_id, @content, @scheduled_at, @status, @content_source_id)
    `);

    return stmt.run(post);
  }

  updatePostStatus(postId, status, metrics = null) {
    const stmt = this.db.prepare(`
      UPDATE posts 
      SET status = @status, 
          metrics = @metrics,
          posted_at = CASE WHEN @status = 'posted' THEN CURRENT_TIMESTAMP ELSE posted_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE post_id = @post_id
    `);

    return stmt.run({
      post_id: postId,
      status,
      metrics: metrics ? JSON.stringify(metrics) : null,
    });
  }

  getScheduledPosts(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM posts 
      WHERE status = 'scheduled' 
        AND scheduled_at <= datetime('now', '+5 minutes')
      ORDER BY scheduled_at ASC 
      LIMIT ?
    `);

    return stmt.all(limit).map(this._parseJsonFields);
  }

  saveUser(user) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO users 
      (user_id, platform, username, display_name, bio, metrics)
      VALUES (@user_id, @platform, @username, @display_name, @bio, @metrics)
    `);

    return stmt.run({
      ...user,
      metrics: JSON.stringify(user.metrics || {}),
    });
  }

  updateUserFollowStatus(userId, isFollowing) {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET is_following = @is_following,
          follow_date = CASE WHEN @is_following = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = @user_id
    `);

    return stmt.run({
      user_id: userId,
      is_following: isFollowing ? 1 : 0,
    });
  }

  getPotentialFollowTargets(limit = 20) {
    const stmt = this.db.prepare(`
      SELECT * FROM users 
      WHERE is_following = 0 
        AND analysis_result IS NOT NULL
        AND json_extract(analysis_result, '$.should_follow') = true
      ORDER BY json_extract(analysis_result, '$.follow_score') DESC 
      LIMIT ?
    `);

    return stmt.all(limit).map(this._parseJsonFields);
  }

  recordInteraction(interaction) {
    const stmt = this.db.prepare(`
      INSERT INTO interactions 
      (interaction_type, target_id, target_type, platform, result)
      VALUES (@interaction_type, @target_id, @target_type, @platform, @result)
    `);

    return stmt.run({
      ...interaction,
      result: JSON.stringify(interaction.result || {}),
    });
  }

  getRateLimitStatus(actionType) {
    const stmt = this.db.prepare(`
      SELECT * FROM rate_limits 
      WHERE action_type = ?
    `);

    const result = stmt.get(actionType);
    
    if (!result) {
      this._initializeRateLimit(actionType);
      return this.getRateLimitStatus(actionType);
    }

    if (result.reset_at && new Date(result.reset_at) <= new Date()) {
      this.resetRateLimit(actionType);
      return this.getRateLimitStatus(actionType);
    }

    return result;
  }

  incrementRateLimit(actionType) {
    const stmt = this.db.prepare(`
      UPDATE rate_limits 
      SET current_count = current_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE action_type = ?
    `);

    return stmt.run(actionType);
  }

  resetRateLimit(actionType) {
    const stmt = this.db.prepare(`
      UPDATE rate_limits 
      SET current_count = 0,
          reset_at = datetime('now', '+1 day'),
          updated_at = CURRENT_TIMESTAMP
      WHERE action_type = ?
    `);

    return stmt.run(actionType);
  }

  _initializeRateLimit(actionType) {
    const limits = {
      post: config.rateLimits.dailyPostLimit,
      follow: config.rateLimits.dailyFollowLimit,
      like: config.rateLimits.dailyLikeLimit,
    };

    const stmt = this.db.prepare(`
      INSERT INTO rate_limits 
      (action_type, daily_limit, current_count, reset_at)
      VALUES (@action_type, @daily_limit, 0, datetime('now', '+1 day'))
    `);

    return stmt.run({
      action_type: actionType,
      daily_limit: limits[actionType] || 100,
    });
  }

  getSetting(key) {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }

  updateSetting(key, value) {
    const stmt = this.db.prepare(`
      UPDATE settings 
      SET value = @value, updated_at = CURRENT_TIMESTAMP
      WHERE key = @key
    `);

    return stmt.run({ key, value });
  }

  getStats() {
    const stats = {};

    stats.totalContents = this.db.prepare('SELECT COUNT(*) as count FROM contents').get().count;
    stats.analyzedContents = this.db.prepare('SELECT COUNT(*) as count FROM contents WHERE analyzed = 1').get().count;
    stats.totalPosts = this.db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
    stats.postedPosts = this.db.prepare('SELECT COUNT(*) as count FROM posts WHERE status = "posted"').get().count;
    stats.scheduledPosts = this.db.prepare('SELECT COUNT(*) as count FROM posts WHERE status = "scheduled"').get().count;
    stats.totalUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    stats.followingUsers = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE is_following = 1').get().count;
    stats.todayInteractions = this.db.prepare(`
      SELECT COUNT(*) as count FROM interactions 
      WHERE date(performed_at) = date('now')
    `).get().count;

    return stats;
  }

  _parseJsonFields(row) {
    if (!row) return row;

    const jsonFields = ['metrics', 'tags', 'analysis_result', 'result', 'config'];
    const parsed = { ...row };

    jsonFields.forEach((field) => {
      if (parsed[field]) {
        try {
          parsed[field] = JSON.parse(parsed[field]);
        } catch (e) {
          logger.warn(`Failed to parse JSON field ${field}:`, e);
        }
      }
    });

    return parsed;
  }

  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }
}

export default new DatabaseManager();