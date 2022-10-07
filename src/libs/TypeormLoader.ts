import { MicroframeworkSettings } from 'microframework';
import { cpus } from 'os';
import 'reflect-metadata';
import { Container } from 'typedi';
import { createConnection, useContainer } from 'typeorm';
import { initializeTransactionalContext, patchTypeORMRepositoryWithBaseRepository } from 'typeorm-transactional-cls-hooked';
import { URL } from 'url';
import { DatabaseConfig } from './ApplicationConfig';
import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';
import { ClassType } from './types';
initializeTransactionalContext(); // Initialize cls-hooked
patchTypeORMRepositoryWithBaseRepository(); // patch Repository with BaseRepository.

export type TypeormLoaderOption = {
  entities?: ClassType[];
  synchronize?: boolean;
};
let dbUrl: URL;
export const typeormLoader = (option: TypeormLoaderOption) => (settings?: MicroframeworkSettings) => {
  const entities = option.entities || [];
  useContainer(Container);
  const cfg = ConfigManager.getConfig<DatabaseConfig>('database');
  dbUrl = new URL(cfg.mariaDBUrl);
  return createConnection({
    type: 'mariadb',
    url: cfg.mariaDBUrl,
    charset: 'utf8mb4',
    // timezone: '+0000',
    synchronize: option.synchronize ?? false,
    logging: ConfigManager.isDevelopment(),
    entities,
    extra: {
      waitForConnections: true,
      connectionLimit: cpus().length * 2 + 1,
    },
  }).then((conn) => {
    settings?.onShutdown(async () => conn.close());
    const logger = Logger.getLogger('TypeormLoader');
    logger.info(`🔗Database connected to ${dbUrl?.hostname}:${dbUrl?.port}${dbUrl?.pathname}. CPU: ${cpus().length}`);
    return conn;
  });
};
