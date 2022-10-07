import * as Pino from 'pino';
import { ConfigManager } from './ConfigManager';

export interface LoggerConfig {
  level: Pino.Level;
  prettyPrint: any;
}

export class Logger {
  static getLogger<T>(owner: (new (...args: any[]) => T) | string): Pino.Logger {
    let tag = 'Logger';
    if (typeof owner === 'string') {
      tag = owner;
    } else {
      tag = owner.name;
    }
    const loggerCfg = ConfigManager.getConfig<LoggerConfig>('logger');
    const logger = Pino.default({
      name: tag,
      level: loggerCfg.level,
      prettyPrint: loggerCfg.prettyPrint,
    });
    return logger;
  }
}
