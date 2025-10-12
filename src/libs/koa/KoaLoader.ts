import cors from '@koa/cors';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import http from 'http';
import jsonata from 'jsonata';
import { default as Koa } from 'koa';
import favicon from 'koa-favicon';
import json from 'koa-json';
import logger from 'koa-logger';
import _ from 'lodash';
import { MicroframeworkSettings } from 'microframework';
import 'reflect-metadata';
import { getMetadataArgsStorage, RoutingControllersOptions, useContainer as useContainerRC } from 'routing-controllers';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import SocketIO from 'socket.io';
import { Container } from 'typedi';
import { ApplicationConfig, ConfigManager } from '../configure';
import { HealthCheckController } from '../healthcheck';
import { KoaLoaderOption } from './KoaLoaderOption';
import { KoaHolder } from './KoaLoaderOption';
import { setupRestfulControllers } from './setupRestfulControllers';
import { setupSocketControllers } from './setupSocketControllers';

export const koaLoader = (option: KoaLoaderOption) => (options?: MicroframeworkSettings) => {
  //  setting up dependency injection container
  useContainerRC(Container);
  //  getting application configuration
  const cfg = ConfigManager.getConfig<ApplicationConfig>('application');
  //   creating Koa application
  const webapp = new Koa();
  KoaHolder.koa = webapp;
  //  adding middleware
  webapp.use(cors());
  webapp.use(favicon('favicon.ico'));
  if (option.use) {
    option.use.forEach((mw) => webapp.use(mw));
  }

  if (ConfigManager.isDevelopment()) {
    webapp.use(logger());
    webapp.use(json());
  }

  // setting up API path
  const svcPath = `/api/v${cfg.version}/${cfg.appName}`;

  // setting up REST controllers
  if (option.restfulControllers) {
    console.log('\n✅ Setting up Restful controllers Start 🚀');
    setupRestfulControllers(webapp, option.restfulControllers, svcPath, option.authorizationChecker, option.currentUserChecker);
    console.log('✅ Setting up Restful controllers Done 🚀\n');
  }
  // creating HTTP server
  const server = http.createServer(webapp.callback());
  //  setting up WebSocket controllers
  if (option.wsControllers) {
    console.log('✅ Setting up Socket.IO controllers Start 🚀');
    const io = new SocketIO.Server(server, { path: `${svcPath}/socket.io` });
    setupSocketControllers(io, option.wsControllers);
    Container.set('SocketIO', io);
    console.log('✅ Setting up Socket.IO controllers Done 🚀\n');
  }

  // setting up shutdown hook
  options?.onShutdown(
    async () =>
      new Promise<void>((done) => {
        console.log('Shutting down the server ...');
        server.close(() => {
          done();
        });
      }),
  );

  // setting up OpenAPI documentation
  // const setupOpenAPI = () => {
  //   const storage = getMetadataArgsStorage();
  //   const schemas = validationMetadatasToSchemas({
  //     refPointerPrefix: '#/components/schemas/',
  //   });
  //   schemas['Object'] = { type: 'string' };
  //   schemas['Array'] = { type: 'array' };

  //   const apiDoccfg = ConfigManager.getConfig<{ disabled: boolean }>('openapiCfg');
  //   if (!apiDoccfg.disabled) {
  //     const pkgVersion = ConfigManager.getPkgVersion();
  //     // 1. 初始化并过滤自定义控制器
  //     const filteredControllers = (option.restfulControllers || []).filter((c) => c);
  //     // 2. 将 HealthCheckController 添加到列表中
  //     // building Routing options for documentation generation
  //     const routingOptions: RoutingControllersOptions = {
  //       routePrefix: svcPath,
  //       // 3. 将完整的控制器列表赋值给 options
  //       controllers: filteredControllers,
  //     };

  //     // if (!Array.isArray(routingOptions.controllers)) {
  //     //   //routingOptions.controllers = [];
  //     // }
  //     routingOptions.controllers?.push(HealthCheckController as any);
  //     const spec = routingControllersToSpec(storage, routingOptions, {
  //       info: {
  //         title: cfg.appName,
  //         description: `Open API 3 doc for module ${cfg.appName}`,
  //         version: `v${cfg.version} / ${pkgVersion}`,
  //       },
  //       servers: [
  //         {
  //           url: `http://localhost:${cfg.port}`,
  //           description: 'Local Development',
  //         },
  //         {
  //           url: `http://${cfg.appName}:${cfg.port}`,
  //           description: 'Dev Development (Must via Dev Proxy)',
  //         },
  //       ],
  //       components: { schemas },
  //     });

  //     const names = new Set();
  //     const expression = jsonata('$sort(*.*.*.tags)');
  //     expression
  //       .evaluate(spec)
  //       .then((result) => {
  //         if (Array.isArray(result)) {
  //           result.forEach((tag: string) => names.add(tag));
  //         }

  //         const tags: Array<any> = [];
  //         Array.from(names).forEach((name) => {
  //           tags.push({
  //             name,
  //             description: `Generated from ${name} controller`,
  //           });
  //         });
  //         spec.tags = tags;
  //       })
  //       .catch((error) => {
  //         console.error('Error processing API tags:', error);
  //         spec.tags = [];
  //       });

  //     webapp.use(async (ctx, next) => {
  //       if (ctx.request.url === `${svcPath}/api/openapi`) {
  //         ctx.response.type = 'application/json; charset=utf-8';
  //         ctx.body = JSON.stringify(spec, null, 2);
  //       } else {
  //         await next();
  //       }
  //     });
  //   }
  // };

  const setupOpenAPI = () => {
    const storage = getMetadataArgsStorage();
    const rawSchemas = validationMetadatasToSchemas({
      refPointerPrefix: '#/components/schemas/',
    });
    // Filter out null/undefined schemas and add default schemas
    const schemas: Record<string, any> = {};
    Object.keys(rawSchemas).forEach((key) => {
      if (rawSchemas[key] !== null && rawSchemas[key] !== undefined) {
        schemas[key] = rawSchemas[key];
      }
    });
    // Add default schemas for common types
    schemas['Object'] = { type: 'object' };
    schemas['Array'] = { type: 'array', items: {} };
    schemas['String'] = { type: 'string' };
    schemas['Number'] = { type: 'number' };
    schemas['Boolean'] = { type: 'boolean' };

    const apiDoccfg = ConfigManager.getConfig<{ disabled: boolean }>('openapiCfg');
    if (!apiDoccfg.disabled) {
      const pkgVersion = ConfigManager.getPkgVersion();
      // 1. åˆå§‹åŒ–å¹¶è¿‡æ»¤è‡ªå®šä¹‰æŽ§åˆ¶å™¨
      const filteredControllers = (option.restfulControllers || []).filter((c) => c);
      // 2. å°† HealthCheckController æ·»åŠ åˆ°åˆ—è¡¨ä¸­
      // building Routing options for documentation generation
      const routingOptions: RoutingControllersOptions = {
        routePrefix: svcPath,
        // 3. å°†å®Œæ•´çš„æŽ§åˆ¶å™¨åˆ—è¡¨èµ‹å€¼ç»™ options
        controllers: filteredControllers,
      };

      // if (!Array.isArray(routingOptions.controllers)) {
      //   //routingOptions.controllers = [];
      // }
      routingOptions.controllers?.push(HealthCheckController as any);
      try {
        const spec = routingControllersToSpec(storage, routingOptions, {
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
        const expression = jsonata('$sort(*.*.*.tags)');
        expression
          .evaluate(spec)
          .then((result) => {
            if (Array.isArray(result)) {
              result.forEach((tag: string) => names.add(tag));
            }

            const tags: Array<any> = [];
            Array.from(names).forEach((name) => {
              tags.push({
                name,
                description: `Generated from ${name} controller`,
              });
            });
            spec.tags = tags;
          })
          .catch((error) => {
            console.error('Error processing API tags:', error);
            spec.tags = [];
          });

        webapp.use(async (ctx, next) => {
          if (ctx.request.url === `${svcPath}/api/openapi`) {
            ctx.response.type = 'application/json; charset=utf-8';
            ctx.body = JSON.stringify(spec, null, 2);
          } else {
            await next();
          }
        });
      } catch (error) {
        console.error('Error generating OpenAPI spec:', error);
        console.error('This may be due to missing validation decorators on controller parameters');
      }
    }
  };

  // setting up OpenAPI documentation
  setupOpenAPI();

  // starting server (if needed)
  if (!option.noListening) {
    return new Promise((resolve) => {
      server.listen(cfg.port, () => {
        resolve(server);
      });
    });
  }
};
