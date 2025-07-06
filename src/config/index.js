import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },
  
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    apiTier: process.env.TWITTER_API_TIER || 'free',
  },
  
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/x-buzz.db'),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/x-buzz.log'),
  },
  
  rateLimits: {
    dailyPostLimit: parseInt(process.env.DAILY_POST_LIMIT, 10) || 10,
    dailyFollowLimit: parseInt(process.env.DAILY_FOLLOW_LIMIT, 10) || 50,
    dailyLikeLimit: parseInt(process.env.DAILY_LIKE_LIMIT, 10) || 100,
  },
  
  scheduling: {
    postScheduleCron: process.env.POST_SCHEDULE_CRON || '0 9,12,15,18,21 * * *',
    contentSearchCron: process.env.CONTENT_SEARCH_CRON || '0 0 * * *',
  },
  
  webUI: {
    enabled: process.env.WEB_UI_ENABLED === 'true',
    sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-me',
  },
};

export function validateConfig() {
  const required = [
    'openai.apiKey',
    'twitter.apiKey',
    'twitter.apiSecret',
    'twitter.accessToken',
    'twitter.accessTokenSecret',
  ];
  
  const missing = [];
  
  for (const path of required) {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        missing.push(path);
        break;
      }
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

export default config;