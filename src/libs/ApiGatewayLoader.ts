/* eslint-disable @typescript-eslint/no-explicit-any */
import _ from 'lodash';
import { MicroframeworkSettings } from 'microframework';
import * as tpl from './apisix/ApisixTemplate';
import { httpPut } from './apisix/HttpPutter';
import { ApplicationConfig } from './ApplicationConfig';
import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';

export type ApiGatewayLoaderOption = any;

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const apiGatewayLoader = (option: ApiGatewayLoaderOption) => async (settings?: MicroframeworkSettings) => {
  const enableApiGateway = process.env['ENABLE_API_GATEWAY'];
  const enableApiGatewayAuth = 'true' === process.env['ENABLE_API_GATEWAY_AUTH'];

  if (!ConfigManager.isDevelopment() && _.isEqual((enableApiGateway ?? '').toLowerCase().trim(), 'true')) {
    const apiGatewayHostPort = process.env['API_GATEWAY_HOST_PORT'] ?? '';
    const [host, _port] = apiGatewayHostPort.split(':');
    const hostPort = _.parseInt(_port ?? '80');
    const domains = (process.env['DOMAINS'] ?? '')
      .split(',')
      .map((domain) => _.trim(domain))
      .filter((domain) => !_.isEmpty(domain));
    const cfg = ConfigManager.getConfig<ApplicationConfig>('application');
    const appName = cfg.appName;
    const appPort = cfg.port;
    const apiVersion = cfg.version;
    const build = ConfigManager.getBuildNumber();
    const version = ConfigManager.getPkgVersion();

    const { apiKey } = ConfigManager.getConfig<{ apiKey: string }>('apisix');

    const upstreamUri = tpl.upstreamUriTemplate(appName);
    const upstreamReqData = tpl.upstreamTemplate(appName, apiVersion, appPort);

    const serviceUri = tpl.serviceUriTemplate(appName);
    const serviceReqData = tpl.serviceTemplate(appName, enableApiGatewayAuth);

    const routeUri = tpl.routeUriTemplate(appName);
    const routeReqData = tpl.routeTemplate(appName, domains, apiVersion, build, version);

    const logger = Logger.getLogger('ApiGatewayLoader');

    await httpPut(host, hostPort, upstreamUri, upstreamReqData, apiKey);
    await sleep(1000);
    await httpPut(host, hostPort, serviceUri, serviceReqData, apiKey);
    await sleep(1000);
    await httpPut(host, hostPort, routeUri, routeReqData, apiKey);

    logger.info(`🔗API Gateway routes mapping updated.`);
  }
};
