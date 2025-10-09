import { bootstrapMicroframework, Microframework, MicroframeworkSettings } from 'microframework';
import 'reflect-metadata';
import { apiGatewayLoader } from '../libs/gateway';
import { ApplicationConfig, ConfigManager } from '../libs/configure';
import { rabbitmqLoader } from '../libs/rabbitmq';
import { koaLoader } from '../libs/koa';
import { Logger } from '../libs/logger';
import { redisLoader } from '../libs/redis';
import { typeormLoader } from '../libs/orm';
import { BootstrapOption } from './BootstrapOption';
import { getLocalIpAddress } from '../libs/network';

const emptyLoader = () => {};
const settingHolder: { setting?: MicroframeworkSettings } = {};

export const bootstrap = async (option: BootstrapOption): Promise<Microframework> => {
  const logger = Logger.getLogger('Bootstrap');
  const loaders = [
    option.disableDatabase ? emptyLoader : typeormLoader(option),
    option.disableRedis ? emptyLoader : redisLoader(option),
    option.disableEvent ? emptyLoader : rabbitmqLoader(option),
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
    const networks = await getLocalIpAddress();
    const host = ConfigManager.isProduction() ? applicationName : networks;
    ConfigManager.basePath = `http://${host}:${cfg.port}/api/v${cfg.version}/${applicationName}/`;
    logger.info(`🚀Server(${applicationName}/v${cfg.version}/${ConfigManager.getPkgVersion()}/${ConfigManager.getBuildNumber()}) is listening on ${ConfigManager.basePath}`);
    if (option.wsControllers) {
      const wsPath = `http://${host}:${cfg.port}/api/v${cfg.version}/${applicationName}/socket.io`;
      logger.info(`🚀Server(${applicationName}/v${cfg.version}/${ConfigManager.getPkgVersion()}/${ConfigManager.getBuildNumber()}) is listening on ${wsPath}`);
    }
    return mfmk;
  });
};
