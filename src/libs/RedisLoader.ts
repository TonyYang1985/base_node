import { MicroframeworkSettings } from 'microframework';
import { Container } from 'typedi';
import { DatabaseConfig } from './ApplicationConfig';
import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';
import { RedisClient } from './RedisClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RedisLoaderOption = any;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const redisLoader = (option: RedisLoaderOption) => (settings?: MicroframeworkSettings) => {
  const cfg = ConfigManager.getConfig<DatabaseConfig>('database');
  const redisClient: RedisClient = new RedisClient(cfg.redis);
  Container.set(RedisClient, redisClient);
  const { redis } = redisClient;
  settings?.onShutdown(async () => redis.disconnect());
  Logger.getLogger('RedisLoader').info(`🔗Redis connected.`);

  return new Promise<void>((resolve) => {
    redis.once('connect', () => {
      resolve();
    });
  });
};
