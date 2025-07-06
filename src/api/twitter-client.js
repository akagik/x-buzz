import { TwitterApi } from 'twitter-api-v2';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import apiTierManager from '../config/api-tier.js';

class TwitterClient {
  constructor() {
    this.client = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessTokenSecret,
    });

    this.v2Client = this.client.v2;
  }

  async postTweet(text, options = {}) {
    try {
      const tweet = await this.v2Client.tweet({
        text,
        ...options,
      });
      
      logger.info('Tweet posted successfully:', { tweetId: tweet.data.id, text });
      return tweet.data;
    } catch (error) {
      logger.error('Error posting tweet:', error);
      throw error;
    }
  }

  async searchTweets(query, options = {}) {
    try {
      apiTierManager.requireCapability('search');
      
      const jsTweets = await this.v2Client.search(query, {
        max_results: options.maxResults || 100,
        'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
        'user.fields': 'name,username,public_metrics,verified',
        'expansions': 'author_id',
        ...options,
      });

      const tweets = [];
      for await (const tweet of jsTweets) {
        tweets.push(tweet);
      }

      logger.info(`Found ${tweets.length} tweets for query: ${query}`);
      return tweets;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'search');
      }
      logger.error('Error searching tweets:', error);
      throw error;
    }
  }

  async searchUsers(query, options = {}) {
    try {
      apiTierManager.requireCapability('getUsers');
      
      const users = await this.v2Client.searchUsers(query, {
        max_results: options.maxResults || 100,
        'user.fields': 'name,username,public_metrics,verified,description,created_at',
        ...options,
      });

      const userList = [];
      for await (const user of users) {
        userList.push(user);
      }

      logger.info(`Found ${userList.length} users for query: ${query}`);
      return userList;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'searchUsers');
      }
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  async followUser(userId) {
    try {
      apiTierManager.requireCapability('follow');
      
      const response = await this.v2Client.follow(
        (await this.getCurrentUser()).id,
        userId,
      );
      
      logger.info('Followed user successfully:', { userId });
      return response.data;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'follow');
      }
      logger.error('Error following user:', error);
      throw error;
    }
  }

  async unfollowUser(userId) {
    try {
      const response = await this.v2Client.unfollow(
        (await this.getCurrentUser()).id,
        userId,
      );
      
      logger.info('Unfollowed user successfully:', { userId });
      return response.data;
    } catch (error) {
      logger.error('Error unfollowing user:', error);
      throw error;
    }
  }

  async likeTweet(tweetId) {
    try {
      apiTierManager.requireCapability('like');
      
      const response = await this.v2Client.like(
        (await this.getCurrentUser()).id,
        tweetId,
      );
      
      logger.info('Liked tweet successfully:', { tweetId });
      return response.data;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'like');
      }
      logger.error('Error liking tweet:', error);
      throw error;
    }
  }

  async unlikeTweet(tweetId) {
    try {
      const response = await this.v2Client.unlike(
        (await this.getCurrentUser()).id,
        tweetId,
      );
      
      logger.info('Unliked tweet successfully:', { tweetId });
      return response.data;
    } catch (error) {
      logger.error('Error unliking tweet:', error);
      throw error;
    }
  }

  async getUserTimeline(userId, options = {}) {
    try {
      apiTierManager.requireCapability('readTimelines');
      
      const timeline = await this.v2Client.userTimeline(userId, {
        max_results: options.maxResults || 100,
        'tweet.fields': 'created_at,public_metrics,author_id',
        exclude: 'retweets,replies',
        ...options,
      });

      const tweets = [];
      for await (const tweet of timeline) {
        tweets.push(tweet);
      }

      logger.info(`Retrieved ${tweets.length} tweets from user timeline:`, { userId });
      return tweets;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getUserTimeline');
      }
      logger.error('Error getting user timeline:', error);
      throw error;
    }
  }

  async getTrendingTopics(query = 'lang:ja') {
    try {
      apiTierManager.requireCapability('getTrends');
      
      // Twitter API v2では直接的なトレンド取得エンドポイントがないため、
      // 人気のツイートを検索して代替とする
      const popularTweets = await this.v2Client.search(query, {
        max_results: 50,
        'tweet.fields': 'created_at,public_metrics,author_id',
        'user.fields': 'name,username,public_metrics',
        'expansions': 'author_id',
        sort_order: 'relevancy', // 関連性順（エンゲージメントが高いもの）
      });

      const tweets = [];
      for await (const tweet of popularTweets) {
        tweets.push(tweet);
      }

      // エンゲージメント数でソート
      const sortedTweets = tweets.sort((a, b) => {
        const aEngagement = (a.public_metrics?.like_count || 0) + 
                           (a.public_metrics?.retweet_count || 0) + 
                           (a.public_metrics?.reply_count || 0);
        const bEngagement = (b.public_metrics?.like_count || 0) + 
                           (b.public_metrics?.retweet_count || 0) + 
                           (b.public_metrics?.reply_count || 0);
        return bEngagement - aEngagement;
      });

      // トレンドトピックを抽出（ハッシュタグやキーワード）
      const trendingTopics = [];
      const seenTopics = new Set();
      
      for (const tweet of sortedTweets) {
        // ハッシュタグを抽出
        const hashtags = tweet.text.match(/#[\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g) || [];
        for (const hashtag of hashtags) {
          if (!seenTopics.has(hashtag.toLowerCase())) {
            seenTopics.add(hashtag.toLowerCase());
            trendingTopics.push({
              name: hashtag,
              tweet_volume: tweet.public_metrics?.like_count || 0,
              url: `https://twitter.com/search?q=${encodeURIComponent(hashtag)}`
            });
          }
        }
        
        if (trendingTopics.length >= 10) break;
      }
      
      logger.info(`Retrieved ${trendingTopics.length} trending topics from search`);
      return trendingTopics;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getTrends');
      }
      logger.error('Error getting trending topics:', error);
      throw error;
    }
  }

  async getTweet(tweetId) {
    try {
      apiTierManager.requireCapability('search');
      
      const tweet = await this.v2Client.singleTweet(tweetId, {
        'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
        'user.fields': 'name,username,public_metrics,verified',
        'expansions': 'author_id',
      });

      logger.info('Retrieved tweet:', { tweetId });
      return tweet.data;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getTweet');
      }
      logger.error('Error getting tweet:', error);
      throw error;
    }
  }

  async getUser(userId) {
    try {
      apiTierManager.requireCapability('getUsers');
      
      const user = await this.v2Client.user(userId, {
        'user.fields': 'name,username,public_metrics,verified,description,created_at',
      });

      logger.info('Retrieved user:', { userId });
      return user.data;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getUser');
      }
      logger.error('Error getting user:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      apiTierManager.requireCapability('getUsers');
      
      if (!this._currentUser) {
        const me = await this.v2Client.me({
          'user.fields': 'name,username,public_metrics,verified,description,created_at',
        });
        this._currentUser = me.data;
      }
      
      return this._currentUser;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getCurrentUser');
      }
      logger.error('Error getting current user:', error);
      throw error;
    }
  }

  async getFollowers(userId, options = {}) {
    try {
      apiTierManager.requireCapability('getUsers');
      
      const followers = await this.v2Client.followers(userId, {
        max_results: options.maxResults || 100,
        'user.fields': 'name,username,public_metrics,verified,description',
        ...options,
      });

      const followerList = [];
      for await (const follower of followers) {
        followerList.push(follower);
      }

      logger.info(`Retrieved ${followerList.length} followers for user:`, { userId });
      return followerList;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getFollowers');
      }
      logger.error('Error getting followers:', error);
      throw error;
    }
  }

  async getFollowing(userId, options = {}) {
    try {
      apiTierManager.requireCapability('getUsers');
      
      const following = await this.v2Client.following(userId, {
        max_results: options.maxResults || 100,
        'user.fields': 'name,username,public_metrics,verified,description',
        ...options,
      });

      const followingList = [];
      for await (const user of following) {
        followingList.push(user);
      }

      logger.info(`Retrieved ${followingList.length} following for user:`, { userId });
      return followingList;
    } catch (error) {
      if (error.code === 403 || error.message?.includes('requires')) {
        return apiTierManager.handleApiError(error, 'getFollowing');
      }
      logger.error('Error getting following:', error);
      throw error;
    }
  }
}

export default new TwitterClient();