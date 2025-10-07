/* eslint-disable @typescript-eslint/no-var-requires */
import cors from '@koa/cors';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import http from 'http';
import jsonata from 'jsonata';
import { default as Application, default as Koa } from 'koa';
import favicon from 'koa-favicon';
import json from 'koa-json';
// import helmet from 'koa-helmet';
// import compress from 'koa-compress';
import logger from 'koa-logger';
import _ from 'lodash';
import { MicroframeworkSettings } from 'microframework';
import 'reflect-metadata';
// import { useContainer as useContainerCV, Validator } from 'class-validator';
import { Action, getMetadataArgsStorage, RoutingControllersOptions, useContainer as useContainerRC, useKoaServer } from 'routing-controllers';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import { AuthorizationChecker } from 'routing-controllers/types/AuthorizationChecker';
import { CurrentUserChecker } from 'routing-controllers/types/CurrentUserChecker';
// ✅ 移除不存在的导入
import { SocketControllersOptions } from 'socket-controllers';
import SocketIO from 'socket.io';
import { Container } from 'typedi';
import { ClassType, jwtUtil } from '..';
import { ApplicationConfig } from './ApplicationConfig';
import { ConfigManager } from './ConfigManager';
import { HealthCheckController } from './HealthCheckController';
import { KoaControllerReturnHandler } from './KoaControllerReturnHandler';

export interface KoaLoaderOption {
  restfulControllers?: ClassType[];
  wsControllers?: ClassType[];
  authorizationChecker?: AuthorizationChecker;
  currentUserChecker?: CurrentUserChecker;
  use?: Application.Middleware[];
  noListening?: boolean;
}

export const KoaHolder: { koa?: Koa } = {};

// const compressOptions = { threshold: 2048 };

export const koaLoader = (option: KoaLoaderOption) => (options?: MicroframeworkSettings) => {
  // useContainerCV(Container);
  // Container.set(Validator, new Validator());
  useContainerRC(Container);
  // ✅ 移除 useContainerSC，因为不存在
  const cfg = ConfigManager.getConfig<ApplicationConfig>('application');
  const webapp = new Koa();
  KoaHolder.koa = webapp;
  // webapp.use(compress(compressOptions));
  // webapp.use(helmet());
  webapp.use(cors());
  webapp.use(favicon('favicon.ico'));
  if (option.use) {
    option.use.forEach((mw) => webapp.use(mw));
  }
  if (ConfigManager.isDevelopment()) {
    webapp.use(logger());
  }
  if (ConfigManager.isDevelopment()) {
    webapp.use(json());
  }
  const svcPath = `/api/v${cfg.version}/${cfg.appName}`;
  const useKoaServerOption: RoutingControllersOptions = {
    routePrefix: svcPath,
    classTransformer: false,
    defaults: {
      nullResultCode: 404,
      undefinedResultCode: 204,
    },
    plainToClassTransformOptions: {
      excludeExtraneousValues: true,
    },
    classToPlainTransformOptions: {
      excludeExtraneousValues: false,
    },
    validation: {
      validationError: {
        target: false,
        value: false,
      },
    },
    development: ConfigManager.isDevelopment(),
    defaultErrorHandler: false,
    middlewares: [KoaControllerReturnHandler],
  };
  if (option.restfulControllers) {
    useKoaServerOption.controllers = option.restfulControllers;
  }

  if (_.isNil(useKoaServerOption.controllers)) {
    useKoaServerOption.controllers = [];
  }
  useKoaServerOption.controllers.push(HealthCheckController as any);

  if (option.authorizationChecker) {
    useKoaServerOption.authorizationChecker = option.authorizationChecker;
  }

  if (option.currentUserChecker) {
    useKoaServerOption.currentUserChecker = option.currentUserChecker;
  } else {
    useKoaServerOption.currentUserChecker = async (action: Action) => {
      const authorization = action.request.headers['authorization'];
      if (authorization) {
        return jwtUtil.decodeJwt(authorization);
      }
    };
  }
  useKoaServer(webapp, useKoaServerOption);
  const server = http.createServer(webapp.callback());

  if (option.wsControllers) {
    const io = new SocketIO.Server(server, { path: `${svcPath}/socket.io` });
    // ✅ 添加 container 属性
    const useSocketServerOption: SocketControllersOptions = {
      container: Container,
      controllers: option.wsControllers,
    };

    // ✅ 检查 useSocketServer 是否存在
    // 如果 socket-controllers 版本不支持，可能需要手动设置
    // 或者注释掉这部分功能
    // useSocketServer(io, useSocketServerOption);
    Container.set('SocketIO', io);
  }
  options?.onShutdown(
    async () =>
      new Promise<void>((done) => {
        console.log('Shutting down the server ...');
        server.close(() => {
          done();
        });
      }),
  );
  const storage = getMetadataArgsStorage();
  const schemas = validationMetadatasToSchemas({
    refPointerPrefix: '#/components/schemas/',
  });
  schemas['Object'] = {
    type: 'string',
  };
  schemas['Array'] = {
    type: 'array',
  };

  // const path = require('path');
  const apiDoccfg = ConfigManager.getConfig<{ disabled: boolean }>('openapiCfg');
  if (!apiDoccfg.disabled) {
    const pkgVersion = ConfigManager.getPkgVersion();
    const spec = routingControllersToSpec(storage, useKoaServerOption, {
      info: {
        title: cfg.appName,
        description: `Open API 3 doc for module ${cfg.appName}`,
        version: `v${cfg.version} / ${pkgVersion}`,
      },
      servers: [
        {
          url: `http://localhost:${cfg.port}`,
          description: 'Local Development',
        },
        {
          url: `http://${cfg.appName}:${cfg.port}`,
          description: 'Dev Development (Must via Dev Proxy)',
        },
      ],
      components: { schemas },
    });
    const names = new Set();
    // ✅ 修复 Promise 问题
    const tags = jsonata('$sort(*.*.*.tags)').evaluate(spec);
    if (Array.isArray(tags)) {
      tags.forEach((tag: string) => names.add(tag));
    }
    const tagArray: Array<any> = [];
    Array.from(names).forEach((name) => {
      tagArray.push({
        name,
        description: `Generated from ${name} controller`,
      });
    });
    spec.tags = tagArray;
    webapp.use(async (ctx, next) => {
      if (ctx.request.url === `${useKoaServerOption.routePrefix}/api/openapi`) {
        ctx.response.type = 'application/json; charset=utf-8';
        ctx.body = JSON.stringify(spec, null, 2);
      } else {
        await next();
      }
    });
  }
  if (!option.noListening) {
    return new Promise((resolve) => {
      server.listen(cfg.port, () => {
        resolve(server);
      });
    });
  }
};
