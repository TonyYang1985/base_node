/**
 * 日志管理器 / Logger Manager
 *
 * 功能说明 / Description:
 * 基于 Pino 的高性能日志管理器，支持开发和生产环境的不同日志格式
 * High-performance logger manager based on Pino, supports different log formats for dev/prod
 *
 * 主要功能 / Main Features:
 * 1. 开发环境美化输出 (pino-pretty) / Pretty print in development
 * 2. 生产环境 JSON 日志 / JSON logs in production
 * 3. 自动配置加载 / Auto config loading
 * 4. 支持 ncc 打包 / Supports ncc bundling
 * 5. 可配置日志级别 / Configurable log levels
 *
 * 日志级别 / Log Levels:
 * - trace: 追踪级别，最详细 / Trace level, most detailed
 * - debug: 调试信息 / Debug information
 * - info: 常规信息 / General information
 * - warn: 警告信息 / Warning information
 * - error: 错误信息 / Error information
 * - fatal: 致命错误 / Fatal errors
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { Logger } from './libs/logger';
 *
 * class UserService {
 *   private logger = Logger.getLogger(UserService);
 *
 *   async createUser(data: any) {
 *     this.logger.info('Creating user', { userId: data.id });
 *     try {
 *       // ... 业务逻辑 / Business logic
 *       this.logger.debug('User created successfully');
 *     } catch (error) {
 *       this.logger.error('Failed to create user', error);
 *     }
 *   }
 * }
 *
 * // 也可以使用字符串标签 / Can also use string tag
 * const logger = Logger.getLogger('MyModule');
 * logger.info('Module initialized');
 * ```
 *
 * 配置文件 / Configuration File:
 * cfg/logger.yml
 * ```yaml
 * level: info
 * prettyPrint:
 *   colorize: true
 *   translateTime: 'SYS:standard'
 * ```
 */
/* eslint-disable @typescript-eslint/ban-ts-comment */

// @ts-ignore
import pino from 'pino';
import { ConfigManager } from '../configure';

/**
 * 日志配置接口 / Logger Configuration Interface
 *
 * 对应配置文件 / Corresponding Config File:
 * - cfg/logger.yml
 * - cfg/logger.{environment}.yml
 */
export interface LoggerConfig {
  /**
   * 日志级别 / Log level
   * 可选值：'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
   * Optional, defaults to 'info'
   */
  level?: pino.Level;

  /**
   * 日志传输配置 / Log transport configuration
   * 用于配置日志输出目标和格式
   * Used to configure log output target and format
   */
  transport?: {
    /**
     * 传输目标模块名 / Transport target module name
     * 例如 / Example: 'pino-pretty'
     */
    target: string;
    /**
     * 传输选项 / Transport options
     * 根据不同的 target 有不同的配置
     * Different targets have different configuration options
     */
    options?: Record<string, any>;
  };

  /**
   * 美化输出配置（已弃用，使用 transport）
   * Pretty print config (deprecated, use transport instead)
   * 为了向后兼容保留此字段
   * Kept for backward compatibility
   */
  prettyPrint?: any;
}

/**
 * 日志管理器类 / Logger Manager Class
 */
export class Logger {
  /**
   * 获取日志记录器实例 / Get Logger Instance
   *
   * @param owner 类构造函数或字符串标签 / Class constructor or string tag
   * @returns Pino 日志记录器实例 / Pino logger instance
   *
   * 功能说明 / Description:
   * 根据类名或字符串标签创建日志记录器，自动加载配置
   * Creates logger based on class name or string tag, auto-loads config
   *
   * 参数类型 / Parameter Types:
   * 1. 类构造函数：使用类名作为日志标签
   *    Class constructor: Uses class name as log tag
   * 2. 字符串：直接使用字符串作为日志标签
   *    String: Uses string directly as log tag
   *
   * 示例 / Examples:
   * ```typescript
   * // 使用类名 / Using class name
   * class UserService {
   *   private logger = Logger.getLogger(UserService);
   * }
   *
   * // 使用字符串 / Using string
   * const logger = Logger.getLogger('DatabaseMigration');
   * ```
   */
  static getLogger<T>(owner: (new (...args: any[]) => T) | string): pino.Logger {
    // 确定日志标签 / Determine log tag
    let tag = 'Logger';
    if (typeof owner === 'string') {
      tag = owner;
    } else {
      tag = owner.name;
    }

    // 1. 加载和转换配置 / Load and transform config
    const loggerCfg = ConfigManager.getConfig<LoggerConfig>('logger');
    const transformedConfig = Logger.transformConfig(loggerCfg);

    // 2. 构建 Pino 选项 / Build Pino options
    const options: Record<string, any> = {
      name: tag,
      level: transformedConfig.level || 'info',
    };

    // --- 针对 ncc/捆绑 的修复：强制使用同步流 ---
    // Fix for ncc/bundling: Force synchronous stream
    if (transformedConfig.transport && transformedConfig.transport.target === 'pino-pretty') {
      try {
        // 关键：使用同步 require 引入 pino-pretty
        // Key: Use synchronous require to include pino-pretty
        // 这样 ncc 才能正确地将它的代码包含在最终的包中
        // This way ncc can correctly include its code in the final bundle
        // @ts-ignore
        const pretty = require('pino-pretty');

        const prettyOptions = transformedConfig.transport.options || {};

        // 创建 pino-pretty 流实例 / Create pino-pretty stream instance
        const prettyStream = pretty(prettyOptions);

        // 使用 pino(options, stream) 旧签名，绕过多线程 'transport'
        // Use pino(options, stream) old signature to bypass multi-threaded 'transport'
        // 注意：这里不再设置 options.transport
        // Note: options.transport is not set here
        return pino(options, prettyStream);
      } catch (err) {
        // 如果流创建失败，回退到原始 JSON 日志
        // If stream creation fails, fallback to raw JSON logs
        console.error('Pino-pretty failed to load as stream. Falling back to raw JSON logs.', err);
        // Fallback: pino(options) 默认写入原始 JSON 到 stdout
        // Fallback: pino(options) defaults to writing raw JSON to stdout
        return pino(options);
      }
    }
    // --- 修复结束 / Fix ends ---

    // 3. 标准 Pino 初始化（用于非 pino-pretty 的 transport 或默认 JSON 输出）
    //    Standard Pino initialization (for non-pino-pretty transport or default JSON output)
    if (transformedConfig.transport) {
      options.transport = transformedConfig.transport;
    }

    const logger = pino(options);
    return logger;
  }

  /**
   * 转换配置格式 / Transform Config Format
   *
   * @param config 原始配置对象 / Original config object
   * @returns 转换后的配置对象 / Transformed config object
   *
   * 功能说明 / Description:
   * 将旧版 prettyPrint 配置转换为新版 transport 配置格式
   * Transforms legacy prettyPrint config to new transport config format
   *
   * 转换规则 / Transformation Rules:
   * 1. 如果已有 transport 配置，直接返回
   *    If transport config exists, return directly
   * 2. 如果有 prettyPrint 配置，转换为 transport 格式
   *    If prettyPrint config exists, convert to transport format
   * 3. 设置默认日志级别为 'info'
   *    Set default log level to 'info'
   *
   * 向后兼容 / Backward Compatibility:
   * 支持旧版的 prettyPrint 配置格式
   * Supports legacy prettyPrint config format
   */
  private static transformConfig(config: LoggerConfig): LoggerConfig {
    const newConfig = { ...config };

    // 设置默认日志级别 / Set default log level
    if (!newConfig.level) {
      newConfig.level = 'info';
    }

    // 如果已有 transport 配置，直接返回
    // If transport config exists, return directly
    if (newConfig.transport) {
      return newConfig;
    }

    // 转换 prettyPrint 为 transport 格式
    // Convert prettyPrint to transport format
    if (newConfig.prettyPrint) {
      newConfig.transport = {
        target: 'pino-pretty',
        options: {},
      };

      // 处理对象格式的 prettyPrint / Handle object format prettyPrint
      if (typeof newConfig.prettyPrint === 'object') {
        newConfig.transport.options = {
          ...newConfig.prettyPrint,
          colorize: newConfig.prettyPrint.colorize !== false,
        };
      } else {
        // 处理布尔值格式的 prettyPrint / Handle boolean format prettyPrint
        newConfig.transport.options = {
          colorize: true,
          translateTime: 'SYS:standard',
        };
      }

      // 删除旧的 prettyPrint 字段 / Delete old prettyPrint field
      delete newConfig.prettyPrint;
    }

    return newConfig;
  }
}