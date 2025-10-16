/**
 * 应用配置接口定义 / Application Configuration Interface Definitions
 *
 * 功能说明 / Description:
 * 定义各类配置文件的 TypeScript 接口，提供类型安全的配置访问
 * Defines TypeScript interfaces for various config files, provides type-safe config access
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { ConfigManager, ApplicationConfig } from './libs/configure';
 *
 * const config = ConfigManager.getConfig<ApplicationConfig>('application');
 * console.log(config.appName); // TypeScript 类型检查 / TypeScript type checking
 * ```
 */

/**
 * 应用配置接口 / Application Configuration Interface
 *
 * 对应配置文件 / Corresponding Config File:
 * - cfg/application.yml
 * - cfg/application.{environment}.yml
 *
 * 示例配置 / Example Config:
 * ```yaml
 * appName: my-api-service
 * version: 1
 * port: 3000
 * privateKeyPath: ./keys/private.key
 * publicKeyPath: ./keys/public.key
 * ```
 */
export interface ApplicationConfig {
  /**
   * 应用名称 / Application name
   * 用于服务标识和路由前缀
   * Used for service identification and route prefix
   */
  appName: string;

  /**
   * API 版本号 / API version number
   * 用于 API 路由版本控制
   * Used for API route versioning
   *
   * 示例 / Example: "1" => /api/v1/...
   */
  version: string;

  /**
   * 服务端口号 / Server port number
   * HTTP 服务监听的端口
   * HTTP server listening port
   */
  port: number;

  /**
   * RSA 私钥文件路径 / RSA private key file path
   * 用于 JWT 签名等加密操作
   * Used for JWT signing and other encryption operations
   *
   * 示例 / Example: "./keys/private.key"
   */
  privateKeyPath: string;

  /**
   * RSA 公钥文件路径 / RSA public key file path
   * 用于 JWT 验证等解密操作
   * Used for JWT verification and other decryption operations
   *
   * 示例 / Example: "./keys/public.key"
   */
  publicKeyPath: string;
}

/**
 * 数据库配置接口 / Database Configuration Interface
 *
 * 对应配置文件 / Corresponding Config File:
 * - cfg/database.yml
 * - cfg/database.{environment}.yml
 *
 * 示例配置 / Example Config:
 * ```yaml
 * mariaDBUrl: mysql://user:password@localhost:3306/mydb
 * output: ./src/entities
 * ```
 */
export interface DatabaseConfig {
  /**
   * MariaDB/MySQL 连接字符串 / MariaDB/MySQL connection string
   * 包含用户名、密码、主机、端口、数据库名
   * Contains username, password, host, port, database name
   *
   * 格式 / Format: "mysql://user:password@host:port/database"
   */
  mariaDBUrl: string;

  /**
   * 实体输出目录 / Entity output directory
   * 代码生成时实体类的输出路径
   * Output path for entity classes during code generation
   *
   * 示例 / Example: "./src/entities"
   */
  output: string;
}

/**
 * Redis 配置接口 / Redis Configuration Interface
 *
 * 对应配置文件 / Corresponding Config File:
 * - cfg/redis.yml
 * - cfg/redis.{environment}.yml
 *
 * 示例配置 / Example Config:
 * ```yaml
 * redis: redis://localhost:6379
 * # 或使用对象格式 / Or use object format
 * redis:
 *   host: localhost
 *   port: 6379
 *   password: mypassword
 *   db: 0
 * ```
 */
export interface RedisConfig {
  /**
   * Redis 连接配置 / Redis connection configuration
   *
   * 支持格式 / Supported Formats:
   * 1. 字符串连接 URL / String connection URL:
   *    "redis://localhost:6379"
   * 2. 配置对象 / Configuration object:
   *    { host: 'localhost', port: 6379, password: '...', db: 0 }
   */
  redis: string | any;
}
