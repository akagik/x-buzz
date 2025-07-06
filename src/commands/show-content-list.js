import contentManager from '../database/content-manager.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: 'ネタリストの表示',
  usage: 'show-content-list [--platform=all] [--analyzed=true] [--limit=20]',
  
  async execute(args = {}) {
    try {
      const { 
        platform = 'all', 
        analyzed = null, 
        limit = 20,
        sortBy = 'viral_score',
      } = args;
      
      let contents;
      
      if (sortBy === 'viral_score' && (analyzed === true || analyzed === null)) {
        contents = await contentManager.getViralContents(
          platform === 'all' ? null : platform,
          limit,
        );
      } else {
        contents = await contentManager.searchContents(null, {
          platform: platform === 'all' ? null : platform,
          analyzed,
          limit,
        });
      }
      
      const stats = await contentManager.getContentStats();
      
      return {
        success: true,
        stats,
        count: contents.length,
        contents: contents.map((content) => ({
          id: content.content_id,
          platform: content.platform,
          type: content.content_type,
          content: content.content.length > 200 
            ? content.content.substring(0, 200) + '...' 
            : content.content,
          author: content.author,
          metrics: content.metrics,
          analyzed: content.analyzed,
          analysisResult: content.analysis_result,
          tags: content.tags,
          createdAt: content.created_at,
        })),
      };
    } catch (error) {
      logger.error('Error showing content list:', error);
      throw error;
    }
  },
};