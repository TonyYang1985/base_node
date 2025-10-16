/**
 * 配置管理器 / Configuration Manager
 *
 * 功能说明 / Description:
 * 单例模式的配置管理器，用于加载和管理 YAML 配置文件
 * Singleton pattern configuration manager for loading and managing YAML config files
 *
 * 主要功能 / Main Features:
 * 1. 自动加载 cfg/ 目录下的 YAML 配置文件
 *    Auto-loads YAML config files from cfg/ directory
 * 2. 支持多环境配置（development, production, test）
 *    Supports multi-environment configs
 * 3. 配置缓存机制，避免重复加载
 *    Config caching to avoid repeated loading
 * 4. 提供环境判断工具方法
 *    Provides environment checking utility methods
 * 5. 获取应用版本和构建号
 *    Get application version and build number
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { ConfigManager, ApplicationConfig } from './libs/configure';
 *
 * // 获取应用配置 / Get application config
 * const appConfig = ConfigManager.getConfig<ApplicationConfig>('application');
 * console.log(appConfig.port); // 3000
 *
 * // 判断环境 / Check environment
 * if (ConfigManager.isDevelopment()) {
 *   console.log('Running in development mode');
 * }
 *
 * // 获取版本信息 / Get version info
 * const version = ConfigManager.getPkgVersion();
 * const buildNum = ConfigManager.getBuildNumber();
 * ```
 */
import { loadConfig } from '../../utils/YamlUtil';

/**
 * 配置映射类型 / Configuration Map Type
 * 键为配置文件名，值为配置对象
 * Key is config file name, value is config object
 */
export type ConfigMap = { [key: string]: unknown };

/**
 * 配置管理器类 / Configuration Manager Class
 * 使用单例模式确保全局只有一个配置管理实例
 * Uses singleton pattern to ensure only one config manager instance globally
 */
export class ConfigManager {
  /**
   * 配置缓存对象 / Configuration cache object
   * 存储已加载的配置文件，避免重复读取
   * Stores loaded config files to avoid repeated reads
   */
  private _config: ConfigMap = {};

  /**
   * Node 运行环境 / Node environment
   * 从环境变量 NODE_ENV 获取（development, production, test）
   * Retrieved from NODE_ENV environment variable
   */
  static readonly nodeEnv = process.env.NODE_ENV;

  /**
   * 单例实例 / Singleton instance
   * 类的唯一实例
   * The only instance of the class
   */
  private static instance = new ConfigManager();

  /**
   * API 基础路径 / API base path
   * 应用启动后设置，用于生成完整的 API URL
   * Set after application starts, used to generate complete API URLs
   *
   * 示例 / Example: "http://localhost:3000/api/v1/myapp/"
   */
  public static basePath = '';

  /**
   * 私有构造函数 / Private constructor
   * 防止外部直接实例化，确保单例模式
   * Prevents external instantiation to ensure singleton pattern
   */
  private constructor() {}

  /**
   * 获取配置缓存对象 / Get config cache object
   * @returns 配置映射 / Configuration map
   */
  get config(): ConfigMap {
    return this._config;
  }

  /**
   * 判断是否为开发环境 / Check if in development environment
   * @returns true 表示开发环境 / true indicates development environment
   *
   * 示例 / Example:
   * ```typescript
   * if (ConfigManager.isDevelopment()) {
   *   console.log('开发模式，启用调试功能');
   * }
   * ```
   */
  static isDevelopment(): boolean {
    return ConfigManager.nodeEnv === 'development';
  }

  /**
   * 判断是否为生产环境 / Check if in production environment
   * @returns true 表示生产环境 / true indicates production environment
   *
   * 示例 / Example:
   * ```typescript
   * if (ConfigManager.isProduction()) {
   *   console.log('生产模式，使用优化配置');
   * }
   * ```
   */
  static isProduction(): boolean {
    return ConfigManager.nodeEnv === 'production';
  }

  /**
   * 加载配置文件 / Load configuration files
   *
   * @param files 配置文件名列表（不含扩展名）
   *              List of config file names (without extension)
   *
   * 功能说明 / Description:
   * 从 cfg/ 目录加载 YAML 配置文件并缓存，如果已加载则跳过
   * Loads YAML config files from cfg/ directory and caches them, skips if already loaded
   *
   * 示例 / Example:
   * ```typescript
   * const manager = ConfigManager.getInstance();
   * manager.load('application', 'database', 'redis');
   * ```
   */
  load(...files: string[]): void {
    files.forEach((f) => {
      // 如果配置未加载，则加载并缓存
      // If config not loaded, load and cache it
      if (!this._config[f]) {
        this._config[f] = loadConfig(f);
      }
    });
  }

  /**
   * 创建类型化的配置对象 / Create typed configuration object
   *
   * @param file 配置文件名 / Config file name
   * @returns 类型化的配置对象 / Typed configuration object
   *
   * 示例 / Example:
   * ```typescript
   * const dbConfig = manager.createConfig<DatabaseConfig>('database');
   * ```
   */
  createConfig<T>(file: string): T {
    const cfg = this._config[file];
    return cfg as T;
  }

  /**
   * 获取配置管理器单例实例 / Get ConfigManager singleton instance
   * @returns 配置管理器实例 / ConfigManager instance
   */
  static getInstance(): ConfigManager {
    return ConfigManager.instance;
  }

  /**
   * 获取配置文件（静态方法）/ Get configuration file (static method)
   *
   * @param configFile 配置文件名（不含扩展名）
   *                   Config file name (without extension)
   * @returns 类型化的配置对象 / Typed configuration object
   *
   * 功能说明 / Description:
   * 便捷的静态方法，自动加载并返回类型化的配置对象
   * Convenient static method that auto-loads and returns typed config object
   *
   * 示例 / Example:
   * ```typescript
   * const appConfig = ConfigManager.getConfig<ApplicationConfig>('application');
   * const redisConfig = ConfigManager.getConfig<RedisConfig>('redis');
   * ```
   */
  static getConfig<T>(configFile: string): T {
    const cfgmgr = ConfigManager.getInstance();
    cfgmgr.load(configFile);
    return cfgmgr.createConfig<T>(configFile);
  }

  /**
   * 获取应用版本号 / Get application version
   * @returns 版本号字符串 / Version string
   *
   * 功能说明 / Description:
   * 从 package.json 读取应用版本号
   * Reads application version from package.json
   *
   * 示例 / Example:
   * ```typescript
   * const version = ConfigManager.getPkgVersion();
   * console.log(`当前版本: ${version}`); // "当前版本: 1.2.3"
   * ```
   */
  static getPkgVersion() {
    const appDir = process.cwd();
    const pkgVersion = require(`${appDir}/package.json`).version;
    return pkgVersion;
  }

  /**
   * 获取构建号 / Get build number
   * @returns 构建号 / Build number
   *
   * 功能说明 / Description:
   * 从 package.json 读取构建号，用于版本追踪
   * Reads build number from package.json for version tracking
   *
   * 示例 / Example:
   * ```typescript
   * const buildNum = ConfigManager.getBuildNumber();
   * console.log(`构建号: ${buildNum}`); // "构建号: 20231215001"
   * ```
   */
  static getBuildNumber() {
    const appDir = process.cwd();
    const buildNumber = require(`${appDir}/package.json`).buildNumber;
    return buildNumber;
  }
}
