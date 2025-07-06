import { validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import aiBuzzAgent from './agents/ai-buzz-agent.js';
import webServer from './web/server.js';

async function main() {
  try {
    logger.info('Starting X-buzz AI Agent...');
    
    // Validate configuration
    validateConfig();
    
    // Initialize the AI agent
    await aiBuzzAgent.initialize();
    
    // Start the web server
    await webServer.start();
    
    // Start the AI agent
    await aiBuzzAgent.start();
    
    logger.info('X-buzz AI Agent is running!');
    
    // Handle graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    logger.error('Failed to start X-buzz AI Agent:', error);
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Shutting down X-buzz AI Agent...');
  
  try {
    await aiBuzzAgent.stop();
    await webServer.stop();
    
    // Close database connection
    const db = await import('./database/db.js');
    db.default.close();
    
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});