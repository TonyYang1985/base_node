/**
 * TypeORM 数据库加载器 / TypeORM Database Loader
 *
 * 功能说明 / Description:
 * 微框架加载器，用于初始化 TypeORM 数据库连接和仓储注册
 * Microframework loader for initializing TypeORM database connection and repository registration
 *
 * 主要功能 / Main Features:
 * 1. 数据库连接初始化 - 连接 MariaDB/MySQL 数据库
 *    Database connection initialization - Connect to MariaDB/MySQL
 * 2. 实体注册 - 注册 TypeORM 实体类
 *    Entity registration - Register TypeORM entities
 * 3. 仓储自动注册 - 将仓储注册到 TypeDI 容器
 *    Auto-repository registration - Register repositories to TypeDI container
 * 4. 事务支持 - 集成 typeorm-transactional 事务管理
 *    Transaction support - Integrate typeorm-transactional transaction management
 * 5. 连接池管理 - 根据 CPU 核心数优化连接池
 *    Connection pool management - Optimize pool size based on CPU cores
 *
 * 事务使用示例 / Transaction Usage Example:
 * ```typescript
 * import { Transactional } from 'typeorm-transactional-cls-hooked';
 *
 * class UserService {
 *   @Transactional()
 *   async createUser(data: any) {
 *     // 所有数据库操作自动在同一事务中执行
 *     // All database operations run in the same transaction
 *     await this.userRepo.save(user);
 *     await this.profileRepo.save(profile);
 *     // 如果抛出错误，自动回滚 / Auto-rollback on error
 *   }
 * }
 * ```
 *
 * 配置文件 / Configuration File:
 * cfg/database.yml
 * ```yaml
 * mariaDBUrl: mysql://user:password@localhost:3306/mydb
 * output: ./src/entities
 * ```
 */
import 'reflect-metadata';
import { MicroframeworkSettings } from 'microframework';
import { cpus } from 'os';
import { DataSource } from 'typeorm';
import { initializeTransactionalContext, patchTypeORMRepositoryWithBaseRepository } from 'typeorm-transactional-cls-hooked';
import { URL } from 'url';
import { DatabaseConfig, ConfigManager } from '../configure';
import { Logger } from '../logger';
import { ClassType } from '../type';
import { Container } from 'typedi';

// 初始化事务上下文 / Initialize transactional context
// 必须在应用启动时执行，为 @Transactional 装饰器提供支持
// Must be executed at application startup to support @Transactional decorator
initializeTransactionalContext();

// 为 TypeORM 仓储打补丁以支持事务
// Patch TypeORM repositories to support transactions
patchTypeORMRepositoryWithBaseRepository();

/**
 * TypeORM 加载器选项 / TypeORM Loader Options
 *
 * 配置说明 / Configuration:
 * - entities: 实体类数组，定义数据库表结构
 *   Array of entity classes that define database table structures
 * - synchronize: 是否自动同步表结构（生产环境禁用）
 *   Whether to auto-sync table structure (disable in production)
 */
export type TypeormLoaderOption = {
  /**
   * 实体类数组 / Array of entity classes
   * TypeORM 实体类，对应数据库表
   * TypeORM entities corresponding to database tables
   */
  entities?: ClassType[];

  /**
   * 自动同步表结构 / Auto-sync table structure
   *
   * 警告 / Warning:
   * - 仅用于开发环境 / Only for development environment
   * - 生产环境必须设为 false / Must be false in production
   * - 可能导致数据丢失 / May cause data loss
   *
   * 默认值 / Default: false
   */
  synchronize?: boolean;
};

/**
 * TypeORM 加载器函数 / TypeORM Loader Function
 *
 * @param option TypeORM 加载选项 / TypeORM loader options
 * @returns 微框架加载器函数 / Microframework loader function
 *
 * 功能说明 / Description:
 * 创建并返回一个微框架加载器，用于初始化 TypeORM 数据库连接
 * Creates and returns a microframework loader for initializing TypeORM database connection
 *
 * 加载流程 / Loading Process:
 * 1. 读取数据库配置 / Read database configuration
 * 2. 创建 DataSource 实例 / Create DataSource instance
 * 3. 初始化数据库连接 / Initialize database connection
 * 4. 注册所有仓储到 TypeDI 容器 / Register all repositories to TypeDI container
 * 5. 注册关闭钩子 / Register shutdown hook
 *
 * 连接池配置 / Connection Pool Configuration:
 * 连接池大小 = CPU 核心数 × 2 + 1
 * Pool size = CPU cores × 2 + 1
 * 这是推荐的数据库连接池大小公式
 * This is the recommended formula for database pool size
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { bootstrap } from './server/bootstrap';
 * import { User, Product } from './entities';
 *
 * bootstrap({
 *   entities: [User, Product],
 *   synchronize: false, // 生产环境必须为 false
 *   // ... 其他选项
 * });
 * ```
 */
export const typeormLoader = (option: TypeormLoaderOption) => (settings?: MicroframeworkSettings) => {
  // 获取实体类数组 / Get array of entity classes
  const entities = option.entities || [];

  // 加载数据库配置 / Load database configuration
  const cfg = ConfigManager.getConfig<DatabaseConfig>('database');
  const logger = Logger.getLogger('TypeormLoader');
  logger.info(`Initializing database connection to "${cfg.mariaDBUrl}"`);

  // 解析数据库 URL / Parse database URL
  const dbUrl = new URL(cfg.mariaDBUrl);

  // 创建 TypeORM DataSource / Create TypeORM DataSource
  const dataSource = new DataSource({
    name: 'default',
    type: 'mariadb',
    url: cfg.mariaDBUrl,
    charset: 'utf8mb4',
    entities,
    // 自动同步表结构（仅开发环境）/ Auto-sync table structure (dev only)
    synchronize: option.synchronize ?? false,
    // 开发环境启用日志 / Enable logging in development
    logging: ConfigManager.isDevelopment(),
    // 连接池配置 / Connection pool configuration
    extra: {
      // 等待可用连接 / Wait for available connections
      waitForConnections: true,
      // 连接池大小：CPU 核心数 × 2 + 1
      // Pool size: CPU cores × 2 + 1
      connectionLimit: cpus().length * 2 + 1,
      // 队列限制：0 表示无限制 / Queue limit: 0 means unlimited
      queueLimit: 0,
    },
  });

  // 初始化数据库连接 / Initialize database connection
  return dataSource
    .initialize()
    .then((conn) => {
      // 注册关闭钩子，应用关闭时断开数据库连接
      // Register shutdown hook to disconnect database on app shutdown
      settings?.onShutdown(async () => await conn.destroy());

      const logger = Logger.getLogger('TypeormLoader');

      // 获取所有实体元数据 / Get all entity metadata
      const entityMetadatas = conn.entityMetadatas;

      // 为每个实体注册仓储到 TypeDI 容器
      // Register repository for each entity to TypeDI container
      entityMetadatas.forEach((metadata) => {
        // 获取实体的仓储实例 / Get repository instance for entity
        const repository = conn.getRepository(metadata.target);
        const entityName = metadata.name;

        // 方式 1: 按实体名称注册（字符串键）
        // Method 1: Register by entity name (string key)
        Container.set(`typeorm.repository.${entityName}`, repository);

        // 方式 2: 按实体类注册（类型键）
        // Method 2: Register by entity class (type key)
        if (typeof metadata.target === 'function') {
          Container.set(metadata.target, repository);
        }

        logger.info(`Repository for entity "${entityName}" registered in container`);
      });

      // 注册 DataSource 到 TypeDI 容器
      // Register DataSource to TypeDI container
      Container.set(DataSource, dataSource);

      // 输出连接成功信息 / Output connection success message
      logger.info(`🔗Database connected to ${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}. CPU: ${cpus().length}`);

      return conn;
    })
    .catch((error) => {
      // 处理连接错误 / Handle connection error
      const logger = Logger.getLogger('TypeormLoader');
      logger.error('Database connection error', error);
      throw error;
    });
};
