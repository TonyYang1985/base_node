import { MicroframeworkSettings } from 'microframework';
import { Container } from 'typedi';
import { DatabaseConfig, ConfigManager, RedisConfig } from '../configure';
import { Logger } from '../logger';
import { RedisClient } from './RedisClient';

export type RedisLoaderOption = unknown;

export const redisLoader = (option: RedisLoaderOption) => (settings?: MicroframeworkSettings) => {
  const cfg = ConfigManager.getConfig<RedisConfig>('redis');
  const redisClient: RedisClient = new RedisClient(cfg.redis);
  Container.set(RedisClient, redisClient);
  const { redis } = redisClient;
  settings?.onShutdown(async () => redis.disconnect());
  Logger.getLogger('RedisLoader').info(`🔗Redis connected. redisCfg: ${cfg.redis} `);

  return new Promise<void>((resolve) => {
    redis.once('connect', () => {
      resolve();
    });
  });
};
