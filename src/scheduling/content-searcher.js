import twitterClient from '../api/twitter-client.js';
import contentManager from '../database/content-manager.js';
import logger from '../utils/logger.js';
import apiTierManager from '../config/api-tier.js';

class ContentSearcher {
  async searchForViralContent() {
    try {
      // Check if we can perform search operations
      if (!apiTierManager.canPerformAction('search')) {
        logger.warn('Search operations are not available on free tier. Upgrade to basic tier for this feature.');
        return {
          message: 'Search requires Basic tier or higher',
          currentTier: apiTierManager.getTier(),
          upgradeUrl: 'https://developer.x.com/en/portal/products'
        };
      }
      const searchQueries = await this.generateSearchQueries();
      let totalFound = 0;

      for (const query of searchQueries) {
        try {
          const tweets = await this.searchTwitterContent(query);
          totalFound += tweets.length;
        } catch (error) {
          logger.error(`Error searching for query "${query}":`, error);
        }
      }

      await this.searchTrendingContent();
      
      logger.info(`Content search completed. Found ${totalFound} potential viral contents`);
    } catch (error) {
      logger.error('Error in content search:', error);
      throw error;
    }
  }

  async generateSearchQueries() {
    const baseQueries = [
      'min_retweets:100 min_faves:500',
      'バズ',
      '話題',
      'RT min_retweets:50',
      '面白い min_faves:100',
      'すごい min_faves:200',
    ];

    const trends = await twitterClient.getTrendingTopics();
    const trendQueries = trends.slice(0, 5).map((trend) => `${trend.name} min_faves:50`);

    return [...baseQueries, ...trendQueries];
  }

  async searchTwitterContent(query) {
    try {
      // Double-check search capability
      if (!apiTierManager.canPerformAction('search')) {
        logger.warn('Twitter search not available on free tier');
        return [];
      }
      const tweets = await twitterClient.searchTweets(query, {
        maxResults: 50,
      });

      const viralTweets = tweets.filter((tweet) => {
        const metrics = tweet.public_metrics || {};
        const engagementRate = this.calculateEngagementRate(metrics);
        return engagementRate > 0.02; // 2% engagement rate threshold
      });

      for (const tweet of viralTweets) {
        await this.saveTweetAsContent(tweet);
      }

      logger.info(`Found ${viralTweets.length} viral tweets for query: ${query}`);
      return viralTweets;
    } catch (error) {
      logger.error('Error searching Twitter content:', error);
      throw error;
    }
  }

  async searchTrendingContent() {
    try {
      const trends = await twitterClient.getTrendingTopics();
      
      for (const trend of trends.slice(0, 10)) {
        try {
          const tweets = await twitterClient.searchTweets(trend.name, {
            maxResults: 20,
          });

          const topTweets = tweets
            .sort((a, b) => {
              const aScore = this.calculateViralScore(a.public_metrics || {});
              const bScore = this.calculateViralScore(b.public_metrics || {});
              return bScore - aScore;
            })
            .slice(0, 5);

          for (const tweet of topTweets) {
            await this.saveTweetAsContent(tweet, { trending: true, trend: trend.name });
          }
        } catch (error) {
          logger.error(`Error searching trend ${trend.name}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error searching trending content:', error);
    }
  }

  async searchUserTimelines() {
    try {
      if (!apiTierManager.canPerformAction('readTimelines')) {
        logger.warn('Timeline reading not available on free tier');
        return;
      }
      const influencers = await this.getInfluencerList();
      
      for (const userId of influencers) {
        try {
          const tweets = await twitterClient.getUserTimeline(userId, {
            maxResults: 50,
          });

          const viralTweets = tweets.filter((tweet) => {
            const score = this.calculateViralScore(tweet.public_metrics || {});
            return score > 100;
          });

          for (const tweet of viralTweets) {
            await this.saveTweetAsContent(tweet, { fromInfluencer: true });
          }
        } catch (error) {
          logger.error(`Error fetching timeline for user ${userId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error searching user timelines:', error);
    }
  }

  async saveTweetAsContent(tweet, additionalData = {}) {
    try {
      const author = tweet.author || {};
      const metrics = tweet.public_metrics || {};

      const contentData = {
        content_id: `twitter_${tweet.id}`,
        platform: 'twitter',
        content_type: 'tweet',
        content: tweet.text,
        author: author.name || author.username,
        author_id: author.id,
        metrics: {
          ...metrics,
          engagement_rate: this.calculateEngagementRate(metrics),
          viral_score: this.calculateViralScore(metrics),
        },
        tags: [
          ...(additionalData.trending ? ['trending'] : []),
          ...(additionalData.fromInfluencer ? ['influencer'] : []),
          ...(additionalData.trend ? [additionalData.trend] : []),
        ],
      };

      await contentManager.addContent(contentData);
    } catch (error) {
      logger.error('Error saving tweet as content:', error);
    }
  }

  calculateEngagementRate(metrics) {
    const totalEngagements = (metrics.like_count || 0) + 
                            (metrics.retweet_count || 0) + 
                            (metrics.reply_count || 0);
    const impressions = metrics.impression_count || 1;
    
    return totalEngagements / impressions;
  }

  calculateViralScore(metrics) {
    const likes = metrics.like_count || 0;
    const retweets = metrics.retweet_count || 0;
    const replies = metrics.reply_count || 0;
    const quotes = metrics.quote_count || 0;

    return (likes * 1) + (retweets * 3) + (replies * 2) + (quotes * 2.5);
  }

  async getInfluencerList() {
    // This would be populated from database or configuration
    return [
      // Add influencer user IDs here
    ];
  }

  async searchYouTubeContent() {
    // Placeholder for YouTube content search
    // Would require YouTube API integration
    logger.info('YouTube content search not yet implemented');
  }

  async searchOtherPlatforms() {
    // Placeholder for other social media platforms
    logger.info('Other platform search not yet implemented');
  }
}

export default new ContentSearcher();