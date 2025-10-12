/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// logger.ts (Example file name)

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pino from 'pino';
import { ConfigManager } from '../configure';

// 接口定义保持不变
export interface LoggerConfig {
  level: pino.Level;
  transport?: {
    target: string;
    options?: Record<string, any>;
  };
  prettyPrint?: any;
}

export class Logger {
  static getLogger<T>(owner: (new (...args: any[]) => T) | string): pino.Logger {
    let tag = 'Logger';
    if (typeof owner === 'string') {
      tag = owner;
    } else {
      tag = owner.name;
    }
    // 1. 加载和转换配置
    const loggerCfg = ConfigManager.getConfig<LoggerConfig>('logger');
    const transformedConfig = Logger.transformConfig(loggerCfg);
    const options: Record<string, any> = {
      name: tag,
      level: transformedConfig.level,
    };

    // --- 针对 ncc/捆绑 的修复：强制使用同步流 ---
    if (transformedConfig.transport && transformedConfig.transport.target === 'pino-pretty') {
      try {
        // 关键：使用同步 require 引入 pino-pretty
        // 这样 ncc 才能正确地将它的代码包含在最终的包中。
        // @ts-ignore
        const pretty = require('pino-pretty');

        const prettyOptions = transformedConfig.transport.options || {};

        // 创建 pino-pretty 流实例
        const prettyStream = pretty(prettyOptions);

        // 使用 pino(options, stream) 旧签名，绕过多线程 'transport'
        // 注意：这里不再设置 options.transport
        return pino(options, prettyStream);
      } catch (err) {
        // 如果流创建失败（例如，pino-pretty 仍未正确安装），则回退到原始 JSON 日志
        console.error('Pino-pretty failed to load as stream. Falling back to raw JSON logs.', err);
        // Fallback: pino(options) 默认写入原始 JSON 到 stdout
        return pino(options);
      }
    }
    // --- 修复结束 ---

    // 4. 标准 Pino 初始化 (用于非 pino-pretty 的 transport 或默认 JSON 输出)
    if (transformedConfig.transport) {
      options.transport = transformedConfig.transport;
    }

    const logger = pino(options);
    return logger;
  }

  // transformConfig 方法保持不变，它负责将 prettyPrint 转换为 transport 格式
  private static transformConfig(config: LoggerConfig): LoggerConfig {
    const newConfig = { ...config };

    if (newConfig.transport) {
      return newConfig;
    }

    if (newConfig.prettyPrint) {
      newConfig.transport = {
        target: 'pino-pretty',
        options: {},
      };

      if (typeof newConfig.prettyPrint === 'object') {
        newConfig.transport.options = {
          ...newConfig.prettyPrint,
          colorize: newConfig.prettyPrint.colorize !== false,
        };
      } else {
        newConfig.transport.options = {
          colorize: true,
          translateTime: 'SYS:standard',
        };
      }

      delete newConfig.prettyPrint;
    }
    return newConfig;
  }
}
