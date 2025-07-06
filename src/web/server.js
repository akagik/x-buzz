import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import apiRouter from './routes/api.js';
import { apiLimiter } from '../rate-limiting/middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WebServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, { 
        ip: req.ip, 
        userAgent: req.get('user-agent'),
      });
      next();
    });
    
    this.app.use('/api', apiLimiter);
  }

  setupRoutes() {
    this.app.use('/api', apiRouter);
    
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });
    
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
    
    this.app.use((err, req, res, next) => {
      logger.error('Server error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: config.env === 'development' ? err.message : undefined,
      });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      if (!config.webUI.enabled) {
        logger.info('Web UI is disabled');
        return resolve();
      }
      
      this.server = this.app.listen(config.port, () => {
        logger.info(`Web server listening on port ${config.port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        logger.error('Server error:', error);
        reject(error);
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        return resolve();
      }
      
      this.server.close(() => {
        logger.info('Web server stopped');
        resolve();
      });
    });
  }
}

export default new WebServer();