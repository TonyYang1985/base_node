import Redis from 'ioredis';
import _ from 'lodash';
import Container, { Service } from 'typedi';
import { Logger } from './Logger';
import { RedisClient } from './RedisClient';
import { fmkTimer } from './Timer';
import { ClassType } from './types';

// const MarkTTL = 24 * 60 * 60;

export type DataProvider<T, P = any> = (parma?: P) => T | Promise<T>;
export type ReplaceObjectPath = { id?: string; value?: string };
export type ReplaceObjectPathFull = { id?: string; value: string };
export type L1TTL = { createdAt: number; ttl: number };
export type CacheServiceEvent = {
  event: string;
  param: any;
  value?: any;
} & Partial<L1TTL>;
export type CacheSynconizer = (key: string, updaterName: string, val: any) => any;

export const CacheServiceEvents = {
  REST: 'REST',
  L1_UPDATE: 'L1_UPDATE',
};

// const CacheListKey = 'CacheService_CacheList';

const levelOneCache: any = {};
const levelOneCacheTTL: Record<any, L1TTL> = {};
const l1Definitions: Record<string, DataProvider<any, any>> = {};
const l2Definitions: Record<string, DataProvider<any, any>> = {};

// const cacheUpdaters: CacheSynconizer[] = [];

// const getSyncCacheKey = (key: string) => `SyncMark:${key}`;
// const getDelCacheKey = (key: string) => `DelMark:${key}`;
const getCacheServiceKey = (key: string) => `CacheService:${key}`;

@Service()
export class CacheService {
  logger = Logger.getLogger(CacheService);

  constructor(private redisClient: RedisClient) {
    this.startCacheService(redisClient.newClient(), redisClient.newClient());
  }

  public startCacheService(redisSub: Redis, redis: Redis) {
    redisSub.subscribe('CacheServiceEvent', (err) => {
      if (err) {
        this.logger.error(err.message);
      } else {
        this.logger.info(`🚀CacheService level 2 cache(redis) subscribed successfully!`);
      }
    });
    redisSub.on('message', (__, message: string) => {
      const logger = Logger.getLogger(CacheService);
      const { event, param, value, ttl, createdAt }: CacheServiceEvent = JSON.parse(message);
      if (event === CacheServiceEvents.REST) {
        if (levelOneCache[param]) {
          delete levelOneCache[param];
          delete levelOneCacheTTL[param];
          logger.info('Reset level 1 cache: %s', param);
        }
        redis.del(getCacheServiceKey(param)).then((n) => {
          if (n > 0) logger.info('Reset level 2 cache: %s', param);
        });
      }
      if (event === CacheServiceEvents.L1_UPDATE) {
        levelOneCache[param] = value;
        if (ttl && createdAt) {
          levelOneCacheTTL[param] = {
            ttl,
            createdAt,
          };
        }
        logger.info('Update level 1 cache: %s', param);
      }
    });

    fmkTimer.onTimer('CacheService:CacheChecker', () => {
      const now = Date.now();
      Object.keys(levelOneCacheTTL)
        .filter((key) => {
          const { createdAt, ttl } = levelOneCacheTTL[key];
          return createdAt + ttl * 1000 < now;
        })
        .forEach((key) => {
          delete levelOneCache[key];
          delete levelOneCacheTTL[key];
        });
    });
  }

  async reset<P>(param: P) {
    await this.redisClient.redis.publish('CacheServiceEvent', JSON.stringify({ event: CacheServiceEvents.REST, param: JSON.stringify(param) }));
  }

  L1<T, P>(param: P, provider: DataProvider<T, P>, ttlSeconds?: number): DataProvider<T, P> {
    l1Definitions[JSON.stringify(param)] = provider;
    return async (parma?: P): Promise<T> => {
      const key = JSON.stringify(parma);
      let value = levelOneCache[key];
      if (_.isNil(value)) {
        value = await Promise.resolve(provider(parma));
        if (!_.isNil(value)) {
          if (ttlSeconds) {
            await this.redisClient.redis.publish(
              'CacheServiceEvent',
              JSON.stringify({
                event: CacheServiceEvents.L1_UPDATE,
                param: key,
                value,
                createdAt: Date.now(),
                ttl: ttlSeconds,
              } as CacheServiceEvent),
            );
          } else {
            await this.redisClient.redis.publish(
              'CacheServiceEvent',
              JSON.stringify({
                event: CacheServiceEvents.L1_UPDATE,
                param: key,
                value,
              } as CacheServiceEvent),
            );
          }
        }
      }
      return value;
    };
  }

  async getL1<T, P>(param: P, provider: DataProvider<T, P>, expire?: number) {
    return this.L1(param, provider, expire)(param);
  }

  L2<T, P>(param: P, provider: DataProvider<T, P>, ttlSeconds?: number): DataProvider<T, P> {
    l2Definitions[JSON.stringify(param)] = provider;
    return async (parma?: P): Promise<T> => {
      const key = getCacheServiceKey(JSON.stringify(parma));
      const valueStr = await this.redisClient.redis.get(key);
      if (_.isNil(valueStr)) {
        const value = await Promise.resolve(provider(parma));
        if (!_.isNil(value)) {
          await this.redisClient.redis.set(key, JSON.stringify(value));
          if (ttlSeconds) {
            await this.redisClient.redis.expire(key, ttlSeconds);
          }
        }
        return value;
      } else {
        return JSON.parse(valueStr);
      }
    };
  }

  async getL2<T, P>(param: P, provider: DataProvider<T, P>, expire?: number) {
    return this.L2(param, provider, expire)(param);
  }

  async createCache<T = any>(key: any, cb: () => T | Promise<T>) {
    const cacheKey = JSON.stringify(key);
    const cacheData = await Promise.resolve(cb());
    if (!_.isNil(cacheData)) {
      await this.redisClient.redis.set(getCacheServiceKey(cacheKey), JSON.stringify(cacheData));
    }
  }

  async updateCache<T = any>(key: any, cb: (currentVal?: T) => (T | undefined) | Promise<T | undefined>) {
    const cacheKey = JSON.stringify(key);
    const redisCacheKey = getCacheServiceKey(cacheKey);
    const currentDataStr = await this.redisClient.redis.get(redisCacheKey);
    const currentData = JSON.parse(currentDataStr ?? 'null');
    const cacheData = await Promise.resolve(cb(currentData ?? undefined));
    if (!_.isNil(cacheData)) {
      await this.redisClient.redis.set(redisCacheKey, JSON.stringify(cacheData));
    }
  }

  async removeCache(key: any) {
    const cacheKey = JSON.stringify(key);
    const redisCacheKey = getCacheServiceKey(cacheKey);
    await this.redisClient.redis.del(redisCacheKey);
  }

  async getCache<T = any>(key: any) {
    const cacheKey = JSON.stringify(key);
    const redisCacheKey = getCacheServiceKey(cacheKey);
    const currentDataStr = await this.redisClient.redis.get(redisCacheKey);
    const currentData = JSON.parse(currentDataStr ?? 'null') as T | null;
    return currentData;
  }

  async getCaches<T = any>(keys: any[]) {
    const cacheKeys = keys.map((key) => JSON.stringify(key));
    const redisCacheKeys = cacheKeys.map((cacheKey) => getCacheServiceKey(cacheKey));
    const currentDataStrArray = await this.redisClient.redis.mget(redisCacheKeys);
    const currentDataArray = currentDataStrArray.map((currentDataStr) => JSON.parse(currentDataStr ?? 'null') as T | null);
    return currentDataArray;
  }
}

export const createCache = async <T = any>(key: any, cb: () => T | Promise<T>) => {
  const cacheService = Container.get(CacheService);
  await cacheService.createCache(key, cb);
};

export const updateCache = async <T = any>(key: any, cb: (currentVal?: T) => (T | undefined) | Promise<T | undefined>) => {
  const cacheService = Container.get(CacheService);
  await cacheService.updateCache(key, cb);
};

export const removeCache = async (key: any) => {
  const cacheService = Container.get(CacheService);
  await cacheService.removeCache(key);
};

export const getCache = async <T = any>(key: any) => {
  const cacheService = Container.get(CacheService);
  return cacheService.getCache<T>(key);
};

export const getCaches = async <T = any>(keys: any[]) => {
  const cacheService = Container.get(CacheService);
  return cacheService.getCaches<T>(keys);
};

export function resetCache<P>(param: P) {
  const cacheService = Container.get(CacheService);
  cacheService.reset(param);
}

export function applyCache<T, C>(target: T, targetPath: ReplaceObjectPath, cache: C[], cachePath: ReplaceObjectPathFull, clone = false) {
  const targetData = clone ? _.cloneDeep(target) : target;
  if (Array.isArray(targetData)) {
    targetData.forEach((t) => replaceObj(t, targetPath, cache, cachePath));
  } else {
    replaceObj(targetData, targetPath, cache, cachePath);
  }
  return targetData;
}

function replaceObj(target: any, targetPath: ReplaceObjectPath, cache: any[], cachePath: ReplaceObjectPathFull) {
  const data = cache.find((c) => _.isEqual(c[cachePath.id ?? 'id'], target[targetPath.id ?? 'id']));
  const value = data[cachePath.value];
  target[targetPath.value ?? cachePath.value] = value;
}

export type TTLSecondFn = (get: <T>(claz: ClassType<T>) => T) => number | Promise<number>;

export type CacheOption = {
  key?: any;
  ttlSeconds?: number | TTLSecondFn;
};

export function L1Cache(option?: CacheOption) {
  return cache(option ?? {}, true);
}

export function L2Cache(option?: CacheOption) {
  return cache(option ?? {}, false);
}

function cache({ key, ttlSeconds }: CacheOption, isL1: boolean) {
  return function (target: any, propertyKey: any, descriptor: PropertyDescriptor): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const param = [key ?? `${target.constructor.name}.${propertyKey}`, ...args];
      const svc = Container.get(CacheService);
      return isL1 ? svc.getL1(param, () => originalMethod.apply(this, args), await getTtlSeconds(ttlSeconds)) : svc.getL2(param, () => originalMethod.apply(this, args), await getTtlSeconds(ttlSeconds));
    };
  };
}

async function getTtlSeconds(val: number | TTLSecondFn | undefined) {
  if (typeof val === 'function') {
    return Promise.resolve(val((claz) => Container.get(claz)));
  } else {
    return Promise.resolve(val);
  }
}
