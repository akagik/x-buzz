import contentSearcher from '../scheduling/content-searcher.js';
import contentManager from '../database/content-manager.js';
import logger from '../utils/logger.js';
import apiTierManager from '../config/api-tier.js';
import freeTierContent from '../services/free-tier-content.js';

export default {
  description: '過去のSNS投稿からバズったコンテンツを検索',
  usage: 'search-viral [--platform=twitter] [--limit=50] [--simple]',
  
  async execute(args = {}) {
    try {
      const { platform = 'all', limit = 50, simple = false } = args;
      
      logger.info('Starting viral content search', { platform, limit, simple });
      
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
      
      // Simple search mode - minimal API calls
      if (simple) {
        try {
          const simpleQuery = 'min_retweets:100 min_faves:500 -is:retweet';
          const tweets = await contentSearcher.searchTwitterContent(simpleQuery);
          
          return {
            message: 'Simple viral content search completed',
            stats: {
              found: tweets.length,
              analyzed: 0,
              platform: 'twitter',
              mode: 'simple'
            },
            topContents: tweets.slice(0, 5).map((tweet) => ({
              id: tweet.id,
              platform: 'twitter',
              content: tweet.text?.substring(0, 100) + '...',
              metrics: tweet.public_metrics,
              author: tweet.author?.username || 'unknown'
            })),
          };
        } catch (error) {
          if (error.code === 429) {
            return {
              success: false,
              message: 'Rate limit reached. Please try again later.',
              resetTime: new Date(error.rateLimit?.reset * 1000).toLocaleString('ja-JP')
            };
          }
          throw error;
        }
      }
      
      // Normal search for paid tiers
      try {
        if (platform === 'all' || platform === 'twitter') {
          await contentSearcher.searchForViralContent();
        }
        
        if (platform === 'all' || platform === 'youtube') {
          await contentSearcher.searchYouTubeContent();
        }
      } catch (error) {
        if (error.code === 429) {
          logger.warn('Rate limited during search, returning existing content');
        } else {
          throw error;
        }
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