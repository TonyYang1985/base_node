/**
 * YAML 配置加载工具 / YAML Configuration Loader Utility
 *
 * 功能说明 / Description:
 * 提供多环境、多区域的 YAML 配置文件加载和合并功能
 * Provides multi-environment and multi-zone YAML configuration file loading and merging
 *
 * 配置加载优先级 / Configuration Loading Priority:
 * 1. 环境配置 (application.{NODE_ENV}.yml) - 最高优先级
 *    Environment config - Highest priority
 * 2. 区域配置 (application.{DEV_ZONE}.yml) - 中等优先级
 *    Zone config - Medium priority
 * 3. 基础配置 (application.yml) - 最低优先级
 *    Base config - Lowest priority
 *
 * 合并策略 / Merge Strategy:
 * 高优先级配置会覆盖低优先级配置的同名字段
 * Higher priority configs override lower priority configs for the same fields
 *
 * 环境变量 / Environment Variables:
 * - NODE_ENV: 运行环境 (development, production, test)
 * - DEV_ZONE: 开发区域 (可选，用于多区域部署)
 *
 * 使用示例 / Usage Example:
 * ```typescript
 * import { loadConfig } from './utils/YamlUtil';
 *
 * // 加载应用配置 / Load application config
 * const appConfig = loadConfig('application');
 * console.log(appConfig.port); // 3000
 *
 * // 加载数据库配置 / Load database config
 * const dbConfig = loadConfig('database');
 * ```
 *
 * 配置文件示例 / Config File Examples:
 * - cfg/application.yml - 基础配置
 * - cfg/application.development.yml - 开发环境配置
 * - cfg/application.production.yml - 生产环境配置
 * - cfg/application.cn.yml - 中国区配置
 */
import fs from 'fs';
import yaml from 'js-yaml';
import { globSync } from 'glob';
import path from 'path';

const mergeJSON = require('merge-json');

/**
 * 配置文件缓存列表 / Configuration files cache list
 * 存储所有扫描到的 YAML 配置文件路径
 * Stores all scanned YAML configuration file paths
 */
const configFiles: string[] = [];

/**
 * 查找配置文件 / Find Configuration File
 *
 * @param searchPath 要查找的配置文件路径（不含扩展名）
 *                   Configuration file path to search (without extension)
 * @returns 找到的配置文件完整路径，未找到返回 undefined
 *          Full path of found config file, undefined if not found
 *
 * 功能说明 / Description:
 * 在配置文件缓存中查找匹配的 YAML 文件，支持多种路径格式
 * Searches for matching YAML file in config cache, supports multiple path formats
 */
const find = (searchPath: string): string | undefined => {
  const targetWithExt = `${searchPath}.yml`;
  return configFiles.find((f) => {
    return (
      f === targetWithExt ||
      f === targetWithExt.replace('./', '') ||
      path.normalize(f) === path.normalize(targetWithExt)
    );
  });
};

/**
 * 配置对象接口 / Configuration Object Interface
 *
 * 支持任意键值对的配置对象
 * Supports configuration object with arbitrary key-value pairs
 */
export interface Config extends Record<string, unknown> {
  [key: string]: unknown;
}

/**
 * 加载配置文件 / Load Configuration File
 *
 * @param name 配置文件名称（不含扩展名和环境后缀）
 *             Configuration file name (without extension and environment suffix)
 * @returns 合并后的配置对象 / Merged configuration object
 *
 * 功能说明 / Description:
 * 按优先级加载并合并多个配置文件，支持环境和区域特定配置
 * Loads and merges multiple config files by priority, supports environment and zone specific configs
 *
 * 加载流程 / Loading Process:
 * 1. 首次调用时扫描 cfg/ 目录下所有 .yml 文件
 *    First call scans all .yml files in cfg/ directory
 * 2. 依次查找环境配置、区域配置、基础配置
 *    Sequentially searches for environment, zone, and base configs
 * 3. 按优先级合并配置对象
 *    Merges config objects by priority
 *
 * 示例 / Example:
 * ```typescript
 * // 假设 NODE_ENV=development, DEV_ZONE=cn
 * // Assuming NODE_ENV=development, DEV_ZONE=cn
 *
 * const config = loadConfig('application');
 * // 会加载并合并以下文件（如果存在）：
 * // Will load and merge following files (if exist):
 * // 1. cfg/application.development.yml
 * // 2. cfg/application.cn.yml
 * // 3. cfg/application.yml
 * ```
 */
export const loadConfig = (name: string): Config => {
  console.log('>>> loadConfig called with name:', name);

  // 首次调用时，扫描配置目录并缓存所有配置文件路径
  // On first call, scan config directory and cache all config file paths
  if (configFiles.length === 0) {
    globSync('./cfg/*.yml').forEach((f: string) => configFiles.push(f));
  }

  // 获取环境和区域变量 / Get environment and zone variables
  const environment = process.env.NODE_ENV;
  const zone = process.env.DEV_ZONE;

  // 构建配置文件路径（不含扩展名）/ Build config file paths (without extension)
  const envConfigFile = `./cfg/${name}.${environment}`;
  const zoneConfigFile = `./cfg/${name}.${zone}`;
  const configFile = `./cfg/${name}`;

  let cfg: Config = {};

  // 1. 加载环境特定配置（最高优先级）
  //    Load environment-specific config (highest priority)
  const envFile = find(envConfigFile);
  if (envFile) {
    const envConfig = yaml.load(fs.readFileSync(envFile, 'utf8')) as Config;
    Object.assign(cfg, envConfig);
  }

  // 2. 加载区域特定配置（中等优先级）
  //    Load zone-specific config (medium priority)
  const zoneFile = find(zoneConfigFile);
  if (zoneFile) {
    const zoneConfig = yaml.load(fs.readFileSync(zoneFile, 'utf8')) as Config;
    Object.assign(cfg, zoneConfig);
  }

  // 3. 加载基础配置（最低优先级，深度合并）
  //    Load base config (lowest priority, deep merge)
  const file = find(configFile);
  if (file) {
    const config = yaml.load(fs.readFileSync(file, 'utf8')) as Config;
    cfg = mergeJSON.merge(cfg, config);
  }

  return cfg;
};