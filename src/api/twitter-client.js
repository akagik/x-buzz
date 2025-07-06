import { TwitterApi } from 'twitter-api-v2';
import config from '../config/index.js';
import logger from '../utils/logger.js';

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
      logger.error('Error searching tweets:', error);
      throw error;
    }
  }

  async searchUsers(query, options = {}) {
    try {
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
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  async followUser(userId) {
    try {
      const response = await this.v2Client.follow(
        (await this.getCurrentUser()).id,
        userId,
      );
      
      logger.info('Followed user successfully:', { userId });
      return response.data;
    } catch (error) {
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
      const response = await this.v2Client.like(
        (await this.getCurrentUser()).id,
        tweetId,
      );
      
      logger.info('Liked tweet successfully:', { tweetId });
      return response.data;
    } catch (error) {
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
      logger.error('Error getting user timeline:', error);
      throw error;
    }
  }

  async getTrendingTopics(woeid = 1) {
    try {
      const trends = await this.client.v1.trendsByPlace(woeid);
      
      if (trends.length > 0) {
        const trendingTopics = trends[0].trends
          .sort((a, b) => (b.tweet_volume || 0) - (a.tweet_volume || 0))
          .slice(0, 10);
        
        logger.info(`Retrieved ${trendingTopics.length} trending topics`);
        return trendingTopics;
      }
      
      return [];
    } catch (error) {
      logger.error('Error getting trending topics:', error);
      throw error;
    }
  }

  async getTweet(tweetId) {
    try {
      const tweet = await this.v2Client.singleTweet(tweetId, {
        'tweet.fields': 'created_at,public_metrics,author_id,conversation_id',
        'user.fields': 'name,username,public_metrics,verified',
        'expansions': 'author_id',
      });

      logger.info('Retrieved tweet:', { tweetId });
      return tweet.data;
    } catch (error) {
      logger.error('Error getting tweet:', error);
      throw error;
    }
  }

  async getUser(userId) {
    try {
      const user = await this.v2Client.user(userId, {
        'user.fields': 'name,username,public_metrics,verified,description,created_at',
      });

      logger.info('Retrieved user:', { userId });
      return user.data;
    } catch (error) {
      logger.error('Error getting user:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      if (!this._currentUser) {
        const me = await this.v2Client.me({
          'user.fields': 'name,username,public_metrics,verified,description,created_at',
        });
        this._currentUser = me.data;
      }
      
      return this._currentUser;
    } catch (error) {
      logger.error('Error getting current user:', error);
      throw error;
    }
  }

  async getFollowers(userId, options = {}) {
    try {
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
      logger.error('Error getting followers:', error);
      throw error;
    }
  }

  async getFollowing(userId, options = {}) {
    try {
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
      logger.error('Error getting following:', error);
      throw error;
    }
  }
}

export default new TwitterClient();