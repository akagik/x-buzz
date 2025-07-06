import logger from '../utils/logger.js';

class CommandHandler {
  constructor() {
    this.commands = new Map();
    this.registerDefaultCommands();
  }

  async registerDefaultCommands() {
    const commands = [
      { name: 'search-viral', module: './search-viral-content.js' },
      { name: 'search-viral-test', module: './search-viral-test.js' },
      { name: 'post-content', module: './post-content.js' },
      { name: 'show-content-list', module: './show-content-list.js' },
      { name: 'show-schedule', module: './show-schedule.js' },
      { name: 'search-users', module: './search-users.js' },
      { name: 'auto-follow', module: './auto-follow.js' },
      { name: 'auto-like', module: './auto-like.js' },
      { name: 'auto-like-test', module: './auto-like-test.js' },
      { name: 'analyze-performance', module: './analyze-performance.js' },
      { name: 'update-settings', module: './update-settings.js' },
      { name: 'show-stats', module: './show-stats.js' },
    ];

    for (const { name, module } of commands) {
      try {
        const handler = await import(module);
        this.register(name, handler.default);
      } catch (error) {
        logger.warn(`Failed to load command ${name}:`, error.message);
      }
    }
  }

  register(name, handler) {
    if (typeof handler !== 'object' || typeof handler.execute !== 'function') {
      throw new Error(`Invalid command handler for ${name}`);
    }

    this.commands.set(name, handler);
    logger.info(`Command registered: ${name}`);
  }

  async execute(commandName, args = {}, context = {}) {
    try {
      const handler = this.commands.get(commandName);
      
      if (!handler) {
        throw new Error(`Unknown command: ${commandName}`);
      }

      logger.info(`Executing command: ${commandName}`, { args });
      
      const result = await handler.execute(args, context);
      
      logger.info(`Command completed: ${commandName}`);
      
      return {
        success: true,
        command: commandName,
        result,
      };
    } catch (error) {
      logger.error(`Command failed: ${commandName}`, error);
      
      return {
        success: false,
        command: commandName,
        error: error.message,
      };
    }
  }

  async executeMultiple(commands) {
    const results = [];
    
    for (const { name, args, context } of commands) {
      const result = await this.execute(name, args, context);
      results.push(result);
    }
    
    return results;
  }

  list() {
    const commandList = [];
    
    for (const [name, handler] of this.commands) {
      commandList.push({
        name,
        description: handler.description || 'No description available',
        usage: handler.usage || `${name} [options]`,
      });
    }
    
    return commandList;
  }

  getCommand(name) {
    return this.commands.get(name);
  }

  hasCommand(name) {
    return this.commands.has(name);
  }
}

export default new CommandHandler();