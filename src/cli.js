#!/usr/bin/env node

import commandHandler from './commands/command-handler.js';
import logger from './utils/logger.js';
import db from './database/db.js';
import rateLimiter from './rate-limiting/rate-limiter.js';

// CLIからのコマンド実行
async function runCommand() {
  try {
    // 引数を取得
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log('使用方法: npm run cli <command> [options]');
      console.log('\n利用可能なコマンド:');
      const commands = commandHandler.list();
      for (const [name, command] of Object.entries(commands)) {
        console.log(`  ${name} - ${command.description}`);
      }
      process.exit(0);
    }

    const commandName = args[0];
    const commandArgs = {};

    // オプションをパース
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const equalIndex = arg.indexOf('=');
        if (equalIndex > -1) {
          const key = arg.substring(2, equalIndex);
          const value = arg.substring(equalIndex + 1);
          commandArgs[key] = value;
        } else {
          const key = arg.substring(2);
          commandArgs[key] = true;
        }
      }
    }

    // データベースとレート制限を初期化
    logger.info(`Initializing CLI for command: ${commandName}`);
    db.initialize();
    rateLimiter.initialize();
    
    // コマンドを登録
    await commandHandler.registerDefaultCommands();

    // コマンドを実行
    logger.info(`Executing command: ${commandName}`, commandArgs);
    const result = await commandHandler.execute(commandName, commandArgs);

    if (result.success) {
      console.log('\n✅ コマンド実行成功');
      console.log(JSON.stringify(result.result, null, 2));
    } else {
      console.error('\n❌ コマンド実行失敗');
      console.error(result.error);
    }
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    logger.error('CLI error:', error);
    process.exit(1);
  } finally {
    // プロセスを終了
    setTimeout(() => process.exit(0), 1000);
  }
}

// メイン処理
runCommand().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});