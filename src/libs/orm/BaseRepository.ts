/**
 * 基础仓储类 / Base Repository Class
 *
 * 功能说明 / Description:
 * 为所有数据访问层提供基础的 CRUD 操作封装
 * Provides basic CRUD operations wrapper for all data access layers
 *
 * 使用方法 / Usage:
 * ```typescript
 * @Service()
 * export class UserRepo extends BaseRepository<User> {
 *   constructor(dataSource: DataSource) {
 *     super(dataSource, User);
 *   }
 *
 *   // 添加自定义方法 / Add custom methods
 *   async findByEmail(email: string) {
 *     return this.repository.findOne({ where: { email } });
 *   }
 * }
 * ```
 *
 * 继承关系 / Inheritance:
 * - 生成的 Repository 类继承此类
 *   Generated Repository classes extend this class
 * - 提供标准化的数据访问接口
 *   Provides standardized data access interface
 */

import { Repository, DataSource, FindOptionsWhere, ObjectLiteral } from 'typeorm';

export class BaseRepository<Entity extends ObjectLiteral> {
  /**
   * TypeORM 仓储实例 / TypeORM repository instance
   * 可在子类中直接使用此实例进行复杂查询
   * Can be used directly in subclasses for complex queries
   */
  protected repository: Repository<Entity>;

  /**
   * 构造函数 / Constructor
   * @param dataSource TypeORM 数据源 / TypeORM DataSource
   * @param entityClass 实体类构造函数 / Entity class constructor
   */
  constructor(
    protected dataSource: DataSource,
    protected entityClass: new () => Entity,
  ) {
    this.repository = this.dataSource.getRepository(entityClass);
  }

  /**
   * 查找多条记录 / Find multiple records
   * @param options 查询选项 (where, order, relations 等) / Query options (where, order, relations, etc.)
   * @returns 实体数组 / Array of entities
   *
   * 示例 / Example:
   * ```typescript
   * const users = await userRepo.find({
   *   where: { isActive: true },
   *   order: { createdAt: 'DESC' },
   *   take: 10
   * });
   * ```
   */
  async find(options?: any) {
    return this.repository.find(options);
  }

  /**
   * 查找单条记录 / Find one record
   * @param options 查询选项 / Query options
   * @returns 实体或 null / Entity or null
   *
   * 示例 / Example:
   * ```typescript
   * const user = await userRepo.findOne({
   *   where: { email: 'user@example.com' }
   * });
   * ```
   */
  async findOne(options?: any) {
    return this.repository.findOne(options);
  }

  /**
   * 根据 ID 查找记录 / Find record by ID
   * @param id 主键值 / Primary key value
   * @returns 实体或 null / Entity or null
   *
   * 示例 / Example:
   * ```typescript
   * const user = await userRepo.findById(1);
   * ```
   */
  async findById(id: any) {
    return this.repository.findOneBy({ id } as FindOptionsWhere<Entity>);
  }

  /**
   * 保存实体 (新增或更新) / Save entity (insert or update)
   * @param entity 实体对象 / Entity object
   * @returns 保存后的实体 / Saved entity
   *
   * 说明 / Description:
   * - 如果实体有 ID 且存在，则更新 / Updates if entity has ID and exists
   * - 如果实体没有 ID 或不存在，则插入 / Inserts if entity has no ID or doesn't exist
   *
   * 示例 / Example:
   * ```typescript
   * const user = new User();
   * user.name = 'John';
   * await userRepo.save(user);
   * ```
   */
  async save(entity: Entity) {
    return this.repository.save(entity);
  }

  /**
   * 更新记录 / Update records
   * @param criteria 更新条件 (ID 或查询条件) / Update criteria (ID or query conditions)
   * @param partialEntity 要更新的字段 / Fields to update
   * @returns 更新结果 / Update result
   *
   * 示例 / Example:
   * ```typescript
   * await userRepo.update(
   *   { email: 'old@example.com' },
   *   { email: 'new@example.com' }
   * );
   * ```
   */
  async update(criteria: any, partialEntity: Partial<Entity>) {
    return this.repository.update(criteria, partialEntity);
  }

  /**
   * 删除记录 / Delete records
   * @param criteria 删除条件 (ID 或查询条件) / Delete criteria (ID or query conditions)
   * @returns 删除结果 / Delete result
   *
   * 示例 / Example:
   * ```typescript
   * await userRepo.delete({ id: 1 });
   * // 或 / or
   * await userRepo.delete(1);
   * ```
   */
  async delete(criteria: any) {
    return this.repository.delete(criteria);
  }
}
