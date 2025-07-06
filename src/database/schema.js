export const schema = {
  contents: `
    CREATE TABLE IF NOT EXISTS contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT,
      author_id TEXT,
      metrics TEXT,
      tags TEXT,
      analyzed BOOLEAN DEFAULT 0,
      analysis_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  posts: `
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      posted_at DATETIME,
      scheduled_at DATETIME,
      status TEXT DEFAULT 'draft',
      metrics TEXT,
      content_source_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (content_source_id) REFERENCES contents(id)
    )
  `,
  
  schedules: `
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_type TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      last_run DATETIME,
      next_run DATETIME,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      bio TEXT,
      metrics TEXT,
      is_following BOOLEAN DEFAULT 0,
      follow_date DATETIME,
      analysis_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  interactions: `
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  rate_limits: `
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT UNIQUE NOT NULL,
      daily_limit INTEGER NOT NULL,
      current_count INTEGER DEFAULT 0,
      reset_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  settings: `
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  logs: `
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

export const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_contents_platform ON contents(platform)',
  'CREATE INDEX IF NOT EXISTS idx_contents_analyzed ON contents(analyzed)',
  'CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)',
  'CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)',
  'CREATE INDEX IF NOT EXISTS idx_users_platform ON users(platform)',
  'CREATE INDEX IF NOT EXISTS idx_users_following ON users(is_following)',
  'CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(interaction_type)',
  'CREATE INDEX IF NOT EXISTS idx_interactions_target ON interactions(target_id, target_type)',
  'CREATE INDEX IF NOT EXISTS idx_rate_limits_action ON rate_limits(action_type)',
  'CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)',
  'CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)',
  'CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at)',
];