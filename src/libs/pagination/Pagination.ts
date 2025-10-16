/**
 * 分页工具 / Pagination Utilities
 *
 * 功能说明 / Description:
 * 提供完整的分页解决方案，包括分页计算、数据转换、排序处理
 * Provides complete pagination solution including page calculation, data transformation, and sorting
 *
 * 主要功能 / Main Features:
 * 1. 分页计算器 - 计算总页数、显示范围等
 *    Pagination calculator - Calculate total pages, display range, etc.
 * 2. 分页输入/输出类 - 标准化的分页参数和结果
 *    Pagination input/output classes - Standardized pagination params and results
 * 3. 数据转换 - 自动将数据库实体转换为 VO
 *    Data transformation - Auto-transform database entities to VOs
 * 4. 排序处理 - 支持多字段排序
 *    Sorting - Supports multi-field sorting
 * 5. TypeORM 集成 - 与 TypeORM 查询构建器无缝集成
 *    TypeORM integration - Seamless integration with TypeORM query builder
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { PaginationIn, PaginationOut, setSorting } from './libs/pagination';
 *
 * // 1. 控制器接收分页参数 / Controller receives pagination params
 * @Post('/users/search')
 * async searchUsers(@Body() pagination: PaginationIn) {
 *   const result = await this.userService.search(pagination);
 *   return result;
 * }
 *
 * // 2. Service 层处理分页 / Service layer handles pagination
 * async search(pagination: PaginationIn): Promise<PaginationOut<UserVo, User>> {
 *   const qb = this.userRepo.createQueryBuilder('user');
 *
 *   // 添加搜索条件 / Add search conditions
 *   if (pagination.search) {
 *     qb.where('user.name LIKE :search', { search: `%${pagination.search}%` });
 *   }
 *
 *   // 添加排序 / Add sorting
 *   setSorting(qb, 'user', pagination.sort);
 *
 *   // 计算总数和分页 / Calculate total and pagination
 *   const total = await qb.getCount();
 *   const { skip, take } = skipAndTake(total, pagination);
 *   const data = await qb.skip(skip).take(take).getMany();
 *
 *   // 返回分页结果 / Return pagination result
 *   return new PaginationOut(total, pagination.pageSize, UserVo, data);
 * }
 * ```
 */
import { paginationCalculator } from 'pagination-calculator';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ct, cv } from '../deps/Libs';
import { transArray } from '../../utils/transformer';
import { i18n } from '../validator';
import { ClassType } from '../type';

const snake = require('to-snake-case');

/**
 * 获取分页计算器 / Get Pagination Calculator
 *
 * @param totalRecords 总记录数 / Total number of records
 * @param pageIndex 页码（从 1 开始）/ Page index (starts from 1)
 * @param pageSize 每页大小 / Page size
 * @returns 分页计算器对象 / Pagination calculator object
 *
 * 功能说明 / Description:
 * 使用 pagination-calculator 库计算分页相关信息
 * Uses pagination-calculator library to calculate pagination info
 *
 * 返回信息包括 / Returned info includes:
 * - pageCount: 总页数 / Total pages
 * - showingStart: 当前页起始记录号 / Current page start record number
 * - showingEnd: 当前页结束记录号 / Current page end record number
 * - hasPrevious: 是否有上一页 / Has previous page
 * - hasNext: 是否有下一页 / Has next page
 */
export const getCalculator = (totalRecords: number, pageIndex: number, pageSize: number) =>
  paginationCalculator({
    total: totalRecords,
    current: pageIndex,
    pageSize: pageSize,
  });

/**
 * 计算 skip 和 take 值 / Calculate Skip and Take Values
 *
 * @param totalRecords 总记录数 / Total number of records
 * @param paginationIn 分页输入参数 / Pagination input parameters
 * @returns skip 和 take 对象 / Object with skip and take values
 *
 * 功能说明 / Description:
 * 根据分页参数计算 TypeORM 查询所需的 skip 和 take 值
 * Calculates skip and take values needed for TypeORM queries based on pagination params
 *
 * 支持两种分页模式 / Supports two pagination modes:
 * 1. 基于页码的分页（pageIndex）/ Page-based pagination
 *    - 使用页码和每页大小计算 / Uses page index and page size
 * 2. 基于记录索引的分页（recordIndex）/ Record-based pagination
 *    - 直接指定起始记录位置 / Directly specifies starting record position
 *
 * 示例 / Example:
 * ```typescript
 * const total = await qb.getCount();
 * const { skip, take } = skipAndTake(total, { pageIndex: 2, pageSize: 10 });
 * // skip = 10, take = 10
 * const results = await qb.skip(skip).take(take).getMany();
 * ```
 */
export const skipAndTake = (totalRecords: number, paginationIn: PaginationIn) => {
  if (paginationIn.pageIndex) {
    // 基于页码的分页 / Page-based pagination
    const calculator = getCalculator(totalRecords, paginationIn.pageIndex, paginationIn.pageSize);
    return {
      skip: calculator.showingStart - 1,
      take: paginationIn.pageSize,
    };
  } else {
    // 基于记录索引的分页 / Record-based pagination
    return { skip: paginationIn.recordIndex ?? 0, take: paginationIn.pageSize };
  }
};

/**
 * 分页输出类 / Pagination Output Class
 *
 * 泛型参数 / Generic Parameters:
 * @template T VO 类型（返回给客户端的数据类型）/ VO type (data type returned to client)
 * @template R 原始数据类型（通常是数据库实体）/ Raw data type (usually database entity)
 *
 * 功能说明 / Description:
 * 封装分页查询结果，包含数据、总记录数、总页数等信息
 * Encapsulates pagination query results including data, total records, total pages, etc.
 *
 * 自动转换功能 / Auto-transformation:
 * 可以自动将数据库实体转换为 VO 对象
 * Can automatically transform database entities to VO objects
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * // 1. 不转换，直接返回原始数据 / No transformation, return raw data
 * const result = new PaginationOut<User, User>(100, 10);
 * result.data = users;
 *
 * // 2. 自动转换为 VO / Auto-transform to VO
 * const result = new PaginationOut(100, 10, UserVo, users);
 * // users 会自动转换为 UserVo 实例数组
 * // users will be auto-transformed to array of UserVo instances
 *
 * // 3. 使用分组转换 / Transform with groups
 * const result = new PaginationOut(100, 10, UserVo, users, ['admin']);
 * // 只导出 admin 分组的字段 / Only export fields in admin group
 * ```
 */
export class PaginationOut<T, R> {
  /**
   * 分页数据 / Paginated data
   * 当前页的数据列表
   * Data list for current page
   */
  data: T[];

  /**
   * 总记录数 / Total number of records
   * 数据库中符合条件的总记录数
   * Total number of records matching the criteria in database
   */
  totalRecords: number;

  /**
   * 总页数 / Total number of pages
   * 根据总记录数和每页大小计算得出
   * Calculated from total records and page size
   */
  pageCount: number;

  /**
   * 构造函数 / Constructor
   *
   * @param totalRecords 总记录数 / Total number of records
   * @param pageSize 每页大小 / Page size
   * @param dataClass VO 类（可选）/ VO class (optional)
   * @param data 原始数据（可选）/ Raw data (optional)
   * @param groups 转换分组（可选）/ Transformation groups (optional)
   *
   * 功能说明 / Description:
   * 创建分页输出对象，可选择性地进行数据转换
   * Creates pagination output object with optional data transformation
   */
  constructor(totalRecords: number, pageSize: number, dataClass?: ClassType<T>, data?: R[], groups?: string[]) {
    // 计算总页数 / Calculate total pages
    const calculator = getCalculator(totalRecords, 1, pageSize);
    this.totalRecords = totalRecords;
    this.pageCount = calculator.pageCount;

    // 如果提供了 VO 类和数据，执行转换
    // If VO class and data are provided, perform transformation
    if (dataClass && data) {
      this.transform(dataClass, data, groups);
    }
  }

  /**
   * 转换数据 / Transform Data
   *
   * @param dataClass VO 类 / VO class
   * @param data 原始数据数组 / Raw data array
   * @param groups 转换分组 / Transformation groups
   *
   * 功能说明 / Description:
   * 将原始数据数组转换为 VO 实例数组
   * Transforms raw data array to array of VO instances
   *
   * 示例 / Example:
   * ```typescript
   * const result = new PaginationOut<UserVo, User>(100, 10);
   * result.transform(UserVo, users, ['public']);
   * ```
   */
  transform(dataClass: ClassType<T>, data: R[], groups?: string[]) {
    this.data = transArray(dataClass, data, groups);
  }
}

/**
 * 分页输入类 / Pagination Input Class
 *
 * 功能说明 / Description:
 * 标准化的分页请求参数，包含分页、搜索、排序等功能
 * Standardized pagination request parameters including paging, search, and sorting
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * // 1. 控制器接收分页参数 / Controller receives pagination params
 * @Post('/users/search')
 * async searchUsers(@Body() pagination: PaginationIn) {
 *   return await this.userService.search(pagination);
 * }
 *
 * // 2. 客户端请求示例 / Client request example
 * POST /users/search
 * {
 *   "pageIndex": 2,       // 第2页 / Page 2
 *   "pageSize": 20,       // 每页20条 / 20 items per page
 *   "search": "john",     // 搜索关键词 / Search keyword
 *   "sort": "!createdAt"  // 按创建时间降序 / Sort by createdAt DESC
 * }
 * ```
 */
@ct.Expose()
export class PaginationIn {
  /**
   * 页码（从 1 开始）/ Page index (starts from 1)
   *
   * 可选字段 / Optional field
   * 与 recordIndex 互斥，优先使用 pageIndex
   * Mutually exclusive with recordIndex, pageIndex takes precedence
   *
   * 示例 / Example: pageIndex = 2 表示第2页 / pageIndex = 2 means page 2
   */
  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsNumber)
  pageIndex?: number;

  /**
   * 记录索引（从 0 开始）/ Record index (starts from 0)
   *
   * 可选字段 / Optional field
   * 用于基于记录位置的分页，适合无限滚动场景
   * Used for record-based pagination, suitable for infinite scroll scenarios
   *
   * 示例 / Example: recordIndex = 20 表示从第21条记录开始
   *                  recordIndex = 20 means start from 21st record
   */
  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsNumber)
  recordIndex?: number;

  /**
   * 每页大小 / Page size
   *
   * 默认值：25 / Default: 25
   * 每页显示的记录数
   * Number of records to display per page
   *
   * 示例 / Example: pageSize = 10 表示每页10条记录
   *                  pageSize = 10 means 10 records per page
   */
  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsNumber)
  pageSize = 25;

  /**
   * 搜索关键词 / Search keyword
   *
   * 可选字段 / Optional field
   * 用于全文搜索或模糊查询
   * Used for full-text search or fuzzy query
   *
   * 示例 / Example:
   * ```typescript
   * // Service 层处理 / Service layer handling
   * if (pagination.search) {
   *   qb.where('user.name LIKE :search', { search: `%${pagination.search}%` });
   * }
   * ```
   */
  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsString)
  search: string;

  /**
   * 排序字段 / Sort field
   *
   * 可选字段 / Optional field
   * 支持单字段或多字段排序（逗号分隔）
   * Supports single or multiple field sorting (comma-separated)
   *
   * 格式规则 / Format Rules:
   * - 字段名：升序排序 / Field name: ascending order
   * - !字段名：降序排序 / !field name: descending order
   *
   * 示例 / Examples:
   * - "createdAt" - 按创建时间升序 / Sort by createdAt ASC
   * - "!createdAt" - 按创建时间降序 / Sort by createdAt DESC
   * - "status,!createdAt" - 先按状态升序，再按创建时间降序
   *                         First by status ASC, then by createdAt DESC
   *
   * 使用方法 / Usage:
   * ```typescript
   * setSorting(qb, 'user', pagination.sort);
   * ```
   */
  @ct.Expose()
  @i18n(cv.IsOptional)
  @i18n(cv.IsString)
  sort: string;
}

/**
 * 设置 TypeORM 查询排序 / Set TypeORM Query Sorting
 *
 * @template T 实体类型 / Entity type
 * @param qb TypeORM 查询构建器 / TypeORM query builder
 * @param alias 表别名 / Table alias
 * @param sorts 排序字段数组 / Array of sort fields
 * @returns 查询构建器（支持链式调用）/ Query builder (supports chaining)
 *
 * 功能说明 / Description:
 * 为 TypeORM 查询构建器添加排序条件，自动处理字段名驼峰转蛇形
 * Adds sorting conditions to TypeORM query builder, auto-converts camelCase to snake_case
 *
 * 排序规则 / Sorting Rules:
 * - 普通字段名：升序排序 / Normal field: ascending order
 * - !开头字段名：降序排序 / Field starting with !: descending order
 * - 自动将驼峰命名转换为蛇形命名 / Auto-converts camelCase to snake_case
 *
 * 使用示例 / Usage Examples:
 * ```typescript
 * // 1. 单字段排序 / Single field sorting
 * const qb = userRepo.createQueryBuilder('user');
 * setSorting(qb, 'user', 'createdAt');
 * // 生成 SQL: ORDER BY user.created_at ASC
 *
 * // 2. 降序排序 / Descending order
 * setSorting(qb, 'user', '!updatedAt');
 * // 生成 SQL: ORDER BY user.updated_at DESC
 *
 * // 3. 多字段排序 / Multiple field sorting
 * setSorting(qb, 'user', 'status', '!createdAt');
 * // 生成 SQL: ORDER BY user.status ASC, user.created_at DESC
 *
 * // 4. 从分页参数获取排序 / Get sorting from pagination params
 * const sorts = pagination.sort?.split(',') || [];
 * setSorting(qb, 'user', ...sorts);
 * ```
 */
export const setSorting = <T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string, ...sorts: string[]) => {
  sorts.forEach((s) => {
    if (s) {
      if (s.startsWith('!')) {
        // 降序排序：移除!前缀，转换为蛇形命名
        // Descending order: remove ! prefix, convert to snake_case
        qb.orderBy(`${alias}.${snake(s.substring(1))}`, 'DESC');
      } else {
        // 升序排序：直接转换为蛇形命名
        // Ascending order: convert to snake_case directly
        qb.orderBy(`${alias}.${snake(s)}`, 'ASC');
      }
    }
  });
  return qb;
};

/**
 * 获取排序对象 / Get Sorting Object
 *
 * @param sorts 排序字段数组 / Array of sort fields
 * @returns 排序对象（字段名到排序方向的映射）
 *          Sorting object (mapping from field name to sort direction)
 *
 * 功能说明 / Description:
 * 将排序字符串数组转换为排序对象，用于 TypeORM 的 order 选项
 * Converts array of sort strings to sorting object for TypeORM's order option
 *
 * 使用示例 / Usage Examples:
 * ```typescript
 * // 1. 基本使用 / Basic usage
 * const sorting = getSorting('createdAt', '!updatedAt');
 * // 返回 / Returns: { createdAt: 'ASC', updatedAt: 'DESC' }
 *
 * // 2. 用于 TypeORM 查询 / Use in TypeORM query
 * const users = await userRepo.find({
 *   order: getSorting('status', '!createdAt')
 * });
 * // 等同于 / Equivalent to:
 * // order: { status: 'ASC', createdAt: 'DESC' }
 *
 * // 3. 从分页参数获取 / Get from pagination params
 * const sorts = pagination.sort?.split(',') || [];
 * const order = getSorting(...sorts);
 * ```
 */
export const getSorting = (...sorts: string[]) => {
  const sort: Record<string, 'ASC' | 'DESC'> = {};
  sorts.forEach((s) => {
    if (s) {
      if (s.startsWith('!')) {
        // 降序：移除!前缀作为字段名 / DESC: remove ! prefix as field name
        sort[s.substring(1)] = 'DESC';
      } else {
        // 升序：直接使用字段名 / ASC: use field name directly
        sort[s] = 'ASC';
      }
    }
  });
  return sort;
};
