#!/usr/bin/env node

import db from './src/database/db.js';
import logger from './src/utils/logger.js';

// テスト用のユーザーデータを追加
async function addTestUsers() {
  try {
    logger.info('Adding test users to database...');
    
    // データベースを初期化
    db.initialize();
    
    // テスト用ユーザーを追加
    const testUsers = [
      {
        user_id: 'test_user_1',
        platform: 'twitter',
        username: 'ai_researcher',
        display_name: 'AI Researcher',
        bio: 'AI and machine learning researcher. Working on deep learning and NLP.',
        metrics: {
          followers_count: 5000,
          following_count: 500,
          tweet_count: 10000,
          listed_count: 100
        }
      },
      {
        user_id: 'test_user_2',
        platform: 'twitter', 
        username: 'tech_blogger',
        display_name: 'Tech Blogger',
        bio: 'Writing about AI, technology, and innovation. Passionate about the future of tech.',
        metrics: {
          followers_count: 15000,
          following_count: 1000,
          tweet_count: 25000,
          listed_count: 500
        }
      },
      {
        user_id: 'test_user_3',
        platform: 'twitter',
        username: 'data_scientist',
        display_name: 'Data Scientist',
        bio: 'Data science and analytics expert. Python, R, and machine learning enthusiast.',
        metrics: {
          followers_count: 8000,
          following_count: 800,
          tweet_count: 12000,
          listed_count: 200
        }
      }
    ];
    
    for (const user of testUsers) {
      db.saveUser(user);
      logger.info(`Added test user: @${user.username}`);
    }
    
    logger.info('Test users added successfully!');
    
    // データベースの統計を表示
    const stats = db.getStats();
    logger.info('Database stats:', stats);
    
    process.exit(0);
  } catch (error) {
    logger.error('Error adding test users:', error);
    process.exit(1);
  }
}

addTestUsers();