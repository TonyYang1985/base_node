import pino from 'pino';
import { ConfigManager } from './ConfigManager';

export interface LoggerConfig {
  level: pino.Level;
  prettyPrint?: boolean; // ✅ 改为 boolean
}

export class Logger {
  static getLogger<T>(owner: (new (...args: any[]) => T) | string): pino.Logger {
    let tag = 'Logger';
    if (typeof owner === 'string') {
      tag = owner;
    } else {
      tag = owner.name;
    }
    const loggerCfg = ConfigManager.getConfig<LoggerConfig>('logger');

    // ✅ 新的 Pino 配置方式
    const logger = pino({
      name: tag,
      level: loggerCfg.level,
      transport: loggerCfg.prettyPrint
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });

    return logger;
  }
}
