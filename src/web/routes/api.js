import { Router } from 'express';
import commandHandler from '../../commands/command-handler.js';
import db from '../../database/db.js';
import rateLimiter from '../../rate-limiting/rate-limiter.js';
import scheduler from '../../scheduling/scheduler.js';
import logger from '../../utils/logger.js';
import { postLimiter } from '../../rate-limiting/middleware.js';

const router = Router();

router.get('/commands', (req, res) => {
  const commands = commandHandler.list();
  res.json({ commands });
});

router.post('/commands/:name', postLimiter, async (req, res) => {
  try {
    const { name } = req.params;
    const args = req.body;
    
    const result = await commandHandler.execute(name, args);
    res.json(result);
  } catch (error) {
    logger.error('Command execution error:', error);
    res.status(500).json({ 
      error: 'Command execution failed',
      message: error.message,
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await commandHandler.execute('show-stats');
    res.json(stats.result);
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/rate-limits', async (req, res) => {
  try {
    const status = await rateLimiter.getStatus();
    res.json({ rateLimits: status });
  } catch (error) {
    logger.error('Rate limit error:', error);
    res.status(500).json({ error: 'Failed to get rate limits' });
  }
});

router.put('/rate-limits/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { limit } = req.body;
    
    if (!limit || limit < 0) {
      return res.status(400).json({ error: 'Invalid limit value' });
    }
    
    rateLimiter.updateLimit(action, limit);
    res.json({ success: true, action, newLimit: limit });
  } catch (error) {
    logger.error('Rate limit update error:', error);
    res.status(500).json({ error: 'Failed to update rate limit' });
  }
});

router.get('/schedules', (req, res) => {
  try {
    const tasks = scheduler.getAllTasks();
    res.json({ schedules: tasks });
  } catch (error) {
    logger.error('Schedule error:', error);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

router.post('/schedules/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { cronExpression, config } = req.body;
    
    if (!cronExpression) {
      return res.status(400).json({ error: 'Cron expression required' });
    }
    
    scheduler.scheduleTask(name, cronExpression, null, config);
    res.json({ success: true, name, cronExpression });
  } catch (error) {
    logger.error('Schedule create error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.delete('/schedules/:name', (req, res) => {
  try {
    const { name } = req.params;
    scheduler.cancelTask(name);
    res.json({ success: true, name });
  } catch (error) {
    logger.error('Schedule cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel schedule' });
  }
});

router.get('/settings', (req, res) => {
  try {
    const settings = db.db.prepare('SELECT * FROM settings').all();
    const formattedSettings = {};
    
    settings.forEach((setting) => {
      if (!formattedSettings[setting.category]) {
        formattedSettings[setting.category] = {};
      }
      formattedSettings[setting.category][setting.key] = setting.value;
    });
    
    res.json({ settings: formattedSettings });
  } catch (error) {
    logger.error('Settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value required' });
    }
    
    db.updateSetting(key, String(value));
    res.json({ success: true, key, value });
  } catch (error) {
    logger.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

router.get('/posts', (req, res) => {
  try {
    const { status = 'all', limit = 50 } = req.query;
    
    let query = 'SELECT * FROM posts';
    const params = [];
    
    if (status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const posts = db.db.prepare(query).all(...params);
    res.json({ posts: posts.map(db._parseJsonFields) });
  } catch (error) {
    logger.error('Posts error:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

router.get('/contents', (req, res) => {
  try {
    const { platform = 'all', analyzed = 'all', limit = 50 } = req.query;
    
    let query = 'SELECT * FROM contents WHERE 1=1';
    const params = [];
    
    if (platform !== 'all') {
      query += ' AND platform = ?';
      params.push(platform);
    }
    
    if (analyzed !== 'all') {
      query += ' AND analyzed = ?';
      params.push(analyzed === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const contents = db.db.prepare(query).all(...params);
    res.json({ contents: contents.map(db._parseJsonFields) });
  } catch (error) {
    logger.error('Contents error:', error);
    res.status(500).json({ error: 'Failed to get contents' });
  }
});

router.get('/logs', (req, res) => {
  try {
    const { level = 'all', limit = 100 } = req.query;
    
    let query = 'SELECT * FROM logs';
    const params = [];
    
    if (level !== 'all') {
      query += ' WHERE level = ?';
      params.push(level);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const logs = db.db.prepare(query).all(...params);
    res.json({ logs: logs.map(db._parseJsonFields) });
  } catch (error) {
    logger.error('Logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

export default router;