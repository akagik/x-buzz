import twitterClient from '../api/twitter-client.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';

export default {
  description: 'ユーザーの検索機能',
  usage: 'search-users --query="..." [--limit=20]',
  
  async execute(args = {}) {
    try {
      const { query, limit = 20 } = args;
      
      if (!query) {
        return {
          success: false,
          error: 'Query parameter is required',
        };
      }
      
      const users = await twitterClient.searchUsers(query, {
        maxResults: limit,
      });
      
      // Save users to database
      for (const user of users) {
        db.saveUser({
          user_id: user.id,
          platform: 'twitter',
          username: user.username,
          display_name: user.name,
          bio: user.description,
          metrics: user.public_metrics,
        });
      }
      
      return {
        success: true,
        count: users.length,
        users: users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          bio: user.description,
          followers: user.public_metrics?.followers_count,
          following: user.public_metrics?.following_count,
          tweets: user.public_metrics?.tweet_count,
          verified: user.verified,
        })),
      };
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  },
};