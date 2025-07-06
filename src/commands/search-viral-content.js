import contentSearcher from '../scheduling/content-searcher.js';
import contentManager from '../database/content-manager.js';
import logger from '../utils/logger.js';
import apiTierManager from '../config/api-tier.js';
import freeTierContent from '../services/free-tier-content.js';

export default {
  description: '過去のSNS投稿からバズったコンテンツを検索',
  usage: 'search-viral [--platform=twitter] [--limit=50]',
  
  async execute(args = {}) {
    try {
      const { platform = 'all', limit = 50 } = args;
      
      logger.info('Starting viral content search', { platform, limit });
      
      // Check if we're on free tier
      if (!apiTierManager.canPerformAction('search')) {
        logger.info('Free tier detected - using AI content generation instead of search');
        
        // Generate content using AI for free tier users
        const generatedContents = await freeTierContent.generateContent(5);
        
        return {
          message: 'Free tier: Generated AI content (search not available)',
          stats: {
            found: generatedContents.length,
            analyzed: 0,
            platform: 'generated',
            tier: apiTierManager.getTier(),
          },
          topContents: generatedContents.slice(0, 5).map((content) => ({
            id: content.content_id,
            platform: content.platform,
            content: content.content.substring(0, 100) + '...',
            metrics: content.metrics,
            viralScore: content.metrics?.viral_score,
          })),
          upgradeInfo: {
            message: 'Upgrade to Basic tier for real-time content search',
            url: 'https://developer.x.com/en/portal/products'
          }
        };
      }
      
      // Normal search for paid tiers
      if (platform === 'all' || platform === 'twitter') {
        await contentSearcher.searchForViralContent();
      }
      
      if (platform === 'all' || platform === 'youtube') {
        await contentSearcher.searchYouTubeContent();
      }
      
      const viralContents = await contentManager.getViralContents(
        platform === 'all' ? null : platform,
        limit,
      );
      
      const unanalyzedCount = await contentManager.analyzeUnanalyzedContents(10);
      
      return {
        message: 'Viral content search completed',
        stats: {
          found: viralContents.length,
          analyzed: unanalyzedCount.length,
          platform,
        },
        topContents: viralContents.slice(0, 5).map((content) => ({
          id: content.content_id,
          platform: content.platform,
          content: content.content.substring(0, 100) + '...',
          metrics: content.metrics,
          viralScore: content.metrics?.viral_score,
        })),
      };
    } catch (error) {
      logger.error('Error searching viral content:', error);
      throw error;
    }
  },
};