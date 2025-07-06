import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import openaiClient from '../api/openai-client.js';
import logger from '../utils/logger.js';

class ContentManager {
  async addContent(contentData) {
    try {
      const content = {
        content_id: contentData.content_id || uuidv4(),
        platform: contentData.platform,
        content_type: contentData.content_type || 'text',
        content: contentData.content,
        author: contentData.author,
        author_id: contentData.author_id,
        metrics: contentData.metrics || {},
        tags: contentData.tags || [],
      };

      db.saveContent(content);
      logger.info('Content saved:', { contentId: content.content_id });

      return content;
    } catch (error) {
      logger.error('Error adding content:', error);
      throw error;
    }
  }

  async analyzeContent(contentId) {
    try {
      const contents = db.getUnanalyzedContents(1);
      const content = contents.find((c) => c.content_id === contentId) || contents[0];

      if (!content) {
        throw new Error('Content not found');
      }

      const analysisResult = await openaiClient.analyzeContent(content.content, {
        platform: content.platform,
        metrics: content.metrics,
      });

      db.updateContentAnalysis(content.content_id, analysisResult);
      logger.info('Content analyzed:', { contentId: content.content_id });

      return analysisResult;
    } catch (error) {
      logger.error('Error analyzing content:', error);
      throw error;
    }
  }

  async analyzeUnanalyzedContents(limit = 10) {
    try {
      const contents = db.getUnanalyzedContents(limit);
      const results = [];

      for (const content of contents) {
        try {
          const analysis = await this.analyzeContent(content.content_id);
          results.push({ contentId: content.content_id, analysis, success: true });
        } catch (error) {
          results.push({ contentId: content.content_id, error: error.message, success: false });
        }
      }

      logger.info(`Analyzed ${results.length} contents`);
      return results;
    } catch (error) {
      logger.error('Error analyzing contents:', error);
      throw error;
    }
  }

  async getViralContents(platform = null, limit = 20) {
    try {
      const contents = db.getTopContents(platform, limit);
      
      return contents.filter((content) => {
        const engagementRate = content.metrics?.engagement_rate || 0;
        const viralThreshold = platform === 'twitter' ? 0.05 : 0.1;
        return engagementRate >= viralThreshold;
      });
    } catch (error) {
      logger.error('Error getting viral contents:', error);
      throw error;
    }
  }

  async searchContents(query, options = {}) {
    try {
      let sqlQuery = `
        SELECT * FROM contents 
        WHERE 1=1
      `;
      const params = [];

      if (query) {
        sqlQuery += ` AND (content LIKE ? OR author LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
      }

      if (options.platform) {
        sqlQuery += ` AND platform = ?`;
        params.push(options.platform);
      }

      if (options.analyzed !== undefined) {
        sqlQuery += ` AND analyzed = ?`;
        params.push(options.analyzed ? 1 : 0);
      }

      sqlQuery += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(options.limit || 50);

      const stmt = db.db.prepare(sqlQuery);
      const results = stmt.all(...params);

      return results.map(db._parseJsonFields);
    } catch (error) {
      logger.error('Error searching contents:', error);
      throw error;
    }
  }

  async getContentStats() {
    try {
      const stats = {
        total: db.db.prepare('SELECT COUNT(*) as count FROM contents').get().count,
        byPlatform: {},
        analyzed: db.db.prepare('SELECT COUNT(*) as count FROM contents WHERE analyzed = 1').get().count,
        viral: 0,
      };

      const platforms = db.db.prepare('SELECT DISTINCT platform FROM contents').all();
      
      for (const { platform } of platforms) {
        const count = db.db.prepare('SELECT COUNT(*) as count FROM contents WHERE platform = ?').get(platform).count;
        stats.byPlatform[platform] = count;
      }

      const viralContents = await this.getViralContents();
      stats.viral = viralContents.length;

      return stats;
    } catch (error) {
      logger.error('Error getting content stats:', error);
      throw error;
    }
  }

  async importFromPlatform(platform, data) {
    try {
      const imported = [];

      for (const item of data) {
        const content = await this.addContent({
          platform,
          content_id: item.id || uuidv4(),
          content: item.text || item.content,
          author: item.author?.name || item.author,
          author_id: item.author?.id || item.author_id,
          content_type: item.type || 'text',
          metrics: item.metrics || {
            likes: item.likes || 0,
            shares: item.shares || 0,
            comments: item.comments || 0,
            views: item.views || 0,
          },
          tags: item.tags || [],
        });

        imported.push(content);
      }

      logger.info(`Imported ${imported.length} contents from ${platform}`);
      return imported;
    } catch (error) {
      logger.error('Error importing contents:', error);
      throw error;
    }
  }
}

export default new ContentManager();