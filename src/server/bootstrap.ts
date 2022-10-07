/* eslint-disable @typescript-eslint/no-var-requires */
import internalIp from 'internal-ip';
import { bootstrapMicroframework, Microframework, MicroframeworkSettings } from 'microframework';
import 'reflect-metadata';
import { apiGatewayLoader } from '../libs/ApiGatewayLoader';
import { ApplicationConfig } from '../libs/ApplicationConfig';
import { ConfigManager } from '../libs/ConfigManager';
import { distributedEventsLoader, DistributedEventsLoaderOption } from '../libs/DistributedEventsLoader';
import { koaLoader, KoaLoaderOption } from '../libs/KoaLoader';
import { Logger } from '../libs/Logger';
import { redisLoader, RedisLoaderOption } from '../libs/RedisLoader';
import { typeormLoader, TypeormLoaderOption } from '../libs/TypeormLoader';

export type BootstrapLoader = (settings?: MicroframeworkSettings) => Promise<any>;

export type BootstrapOption = KoaLoaderOption &
  TypeormLoaderOption &
  RedisLoaderOption &
  DistributedEventsLoaderOption & {
    disableRedis?: boolean;
    disableDatabase?: boolean;
    disableEvent?: boolean;
    loaders?: BootstrapLoader[];
  };

const settingHolder: {
  setting?: MicroframeworkSettings;
} = {};

// eslint-disable-next-line @typescript-eslint/no-empty-function
const emptyLoader = () => {};

export const bootstrap = async (option: BootstrapOption): Promise<Microframework> => {
  const logger = Logger.getLogger('Bootstrap');
  const loaders = [
    option.disableDatabase ? emptyLoader : typeormLoader(option),
    option.disableRedis ? emptyLoader : redisLoader(option),
    option.disableEvent ? emptyLoader : distributedEventsLoader(option),
    koaLoader(option),
    apiGatewayLoader(option),
    (settings?: MicroframeworkSettings) => {
      settingHolder.setting = settings;
    },
  ];
  if (option.loaders) {
    loaders.push(...option.loaders);
  }
  return bootstrapMicroframework({
    config: {
      showBootstrapTime: ConfigManager.isDevelopment(),
    },
    loaders,
  }).then(async (mfmk) => {
    (mfmk as any).frameworkSettings = settingHolder.setting;
    const cfg = ConfigManager.getConfig<ApplicationConfig>('application');
    const applicationName = cfg.appName;
    const host = ConfigManager.isProduction() ? applicationName : await internalIp.v4();
    ConfigManager.basePath = `http://${host}:${cfg.port}/api/v${cfg.version}/${applicationName}/`;
    logger.info(`🚀Server(${applicationName}/v${cfg.version}/${ConfigManager.getPkgVersion()}/${ConfigManager.getBuildNumber()}) is listening on ${ConfigManager.basePath}`);
    if (option.wsControllers) {
      const wsPath = `http://${host}:${cfg.port}/api/v${cfg.version}/${applicationName}/socket.io`;
      logger.info(`🚀Server(${applicationName}/v${cfg.version}/${ConfigManager.getPkgVersion()}/${ConfigManager.getBuildNumber()}) is listening on ${wsPath}`);
    }
    return mfmk;
  });
};
