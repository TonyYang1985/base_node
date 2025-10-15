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
  // Setting up dependency injection container
  useContainerRC(Container);

  // Getting application configuration
  const cfg = ConfigManager.getConfig<ApplicationConfig>('application');

  // Creating Koa application
  const webapp = new Koa();
  KoaHolder.koa = webapp;

  // Adding middleware
  webapp.use(cors());
  webapp.use(favicon('favicon.ico'));
  if (option.use) {
    option.use.forEach((mw) => webapp.use(mw));
  }

  if (ConfigManager.isDevelopment()) {
    webapp.use(logger());
    webapp.use(json());
  }

  // Setting up API path
  const svcPath = `/api/v${cfg.version}/${cfg.appName}`;

  // Setting up REST controllers
  if (option.restfulControllers) {
    console.log('\n✅ Setting up Restful controllers Start 🚀');
    setupRestfulControllers(webapp, option.restfulControllers, svcPath, option.authorizationChecker, option.currentUserChecker);
    console.log('✅ Setting up Restful controllers Done 🚀\n');
  }

  // Creating HTTP server
  const server = http.createServer(webapp.callback());

  // Setting up WebSocket controllers
  if (option.wsControllers) {
    console.log('✅ Setting up Socket.IO controllers Start 🚀');
    const io = new SocketIO.Server(server, { path: `${svcPath}/socket.io` });
    setupSocketControllers(io, option.wsControllers);
    Container.set('SocketIO', io);
    console.log('✅ Setting up Socket.IO controllers Done 🚀\n');
  }

  // Setting up shutdown hook
  options?.onShutdown(
    async () =>
      new Promise<void>((done) => {
        console.log('Shutting down the server ...');
        server.close(() => {
          done();
        });
      }),
  );

  // Setting up OpenAPI documentation
  const setupOpenAPI = () => {
    const storage = getMetadataArgsStorage();

    // Diagnostic: Check for parameters without proper types
    console.log('\n🔍 Checking controller parameters...');
    const filteredControllers = (option.restfulControllers || []).filter((c) => c);

    // Collect all classes used in parameters
    const usedClasses = new Set<string>();

    storage.actions.forEach((action) => {
      const controllerName = action.target.name;
      const methodName = action.method;

      // Check if this action belongs to one of our controllers
      const isOurController = filteredControllers.some((ctrl) => ctrl.name === controllerName) || controllerName === 'HealthCheckController';

      if (isOurController) {
        const params = storage.params.filter((p) => p.object === action.target && p.method === methodName);

        params.forEach((param) => {
          const paramType = param.type as any;
          if (!paramType || paramType === Object) {
            console.warn(`⚠️  Parameter without explicit type: ${controllerName}.${methodName}() - ` + `parameter index ${param.index} (${param.name || 'unnamed'})`);
          } else if (typeof paramType === 'function' && paramType.name) {
            const typeName = paramType.name;
            const builtInTypes = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Object'];
            if (!builtInTypes.includes(typeName)) {
              usedClasses.add(typeName);
              console.log(`📋 ${controllerName}.${methodName}() uses class: ${typeName} ` + `(parameter: ${param.name || `index ${param.index}`})`);
            }
          }
        });
      }
    });

    console.log(`\n📊 Total unique classes used in parameters: ${usedClasses.size}`);

    const rawSchemas = validationMetadatasToSchemas({
      refPointerPrefix: '#/components/schemas/',
    });

    // Filter out null/undefined schemas and add default schemas
    const schemas: Record<string, any> = {};
    console.log('\n🔍 Checking generated schemas...');
    Object.keys(rawSchemas).forEach((key) => {
      if (rawSchemas[key] !== null && rawSchemas[key] !== undefined) {
        schemas[key] = rawSchemas[key];
        console.log(`✅ Schema found: ${key}`);
      } else {
        console.warn(`❌ Null/undefined schema detected for key: ${key}`);
      }
    });

    // Check which used classes are missing schemas
    console.log('\n🔍 Checking for missing schemas...');
    const missingSchemas: string[] = [];
    usedClasses.forEach((className) => {
      if (!schemas[className]) {
        console.error(`❌ MISSING SCHEMA: ${className} - This will cause OpenAPI generation to fail!`);
        missingSchemas.push(className);
      } else {
        console.log(`✅ Schema exists: ${className}`);
      }
    });

    // If there are missing schemas, provide detailed fix instructions
    if (missingSchemas.length > 0) {
      console.error('\n' + '='.repeat(80));
      console.error('🚨 ACTION REQUIRED: Classes without validation decorators detected!');
      console.error('='.repeat(80));
      console.error('\nThe following classes are used in @QueryParams() but lack validation decorators:');
      missingSchemas.forEach((className) => {
        console.error(`  ❌ ${className}`);
      });

      console.error('\n📝 HOW TO FIX:');
      console.error('Add class-validator decorators to each property in these classes.');
      console.error('\nExample fix:\n');
      console.error("  import { IsString, IsOptional } from 'class-validator';");
      console.error("  // or use your project's wrapper:");
      console.error("  import { cv, i18n } from '../../src';");
      console.error('');
      console.error('  @Expose()');
      console.error('  class YourClass extends PaginationIn {');
      console.error('    @IsString()      // ✅ Add this');
      console.error('    @IsOptional()    // ✅ Add this (for optional fields)');
      console.error('    @Expose()');
      console.error('    yourField: string;');
      console.error('');
      console.error('    // Or using i18n wrapper:');
      console.error('    @i18n(cv.IsString)');
      console.error('    @cv.IsOptional()');
      console.error('    @Expose()');
      console.error('    anotherField: string;');
      console.error('  }');
      console.error('');
      console.error('💡 Why this is needed:');
      console.error('  - Generates OpenAPI documentation automatically');
      console.error('  - Provides runtime validation for API requests');
      console.error('  - Ensures type safety and data integrity');
      console.error('\n' + '='.repeat(80) + '\n');

      // Create placeholder schemas to prevent crash
      console.log('🔧 Creating temporary placeholder schemas to allow server to start...');
      missingSchemas.forEach((className) => {
        schemas[className] = {
          type: 'object',
          properties: {},
          additionalProperties: true,
          required: [],
          description: `TEMPORARY: Add @IsString(), @IsOptional() etc. decorators to ${className} class properties`,
        };
        console.log(`  ⚠️  Created placeholder for ${className}`);
      });
      console.log('✅ Server will start, but please fix the classes above for proper OpenAPI docs!\n');
    }

    // Add default schemas for common types
    schemas['Object'] = { type: 'object' };
    schemas['Array'] = { type: 'array', items: {} };
    schemas['String'] = { type: 'string' };
    schemas['Number'] = { type: 'number' };
    schemas['Boolean'] = { type: 'boolean' };
    schemas['Date'] = { type: 'string', format: 'date-time' };

    // Manually add schemas for classes without validation decorators
    if (!schemas['UserSearch']) {
      console.log('⚠️  Manually creating schema for UserSearch (no validation decorators found)');
      schemas['UserSearch'] = {
        type: 'object',
        properties: {
          app: { type: 'string' },
          userName: { type: 'string' },
          // Inherit properties from PaginationIn
          pageIndex: { type: 'number' },
          recordIndex: { type: 'number' },
          pageSize: { type: 'number' },
          search: { type: 'string' },
          sort: { type: 'string' },
        },
        required: [],
      };
    }

    const apiDoccfg = ConfigManager.getConfig<{ disabled: boolean }>('openapiCfg');
    if (!apiDoccfg.disabled) {
      const pkgVersion = ConfigManager.getPkgVersion();

      // Patch parameter metadata to ensure all parameters have valid types
      console.log('\n🔧 Patching parameter metadata...');
      storage.params.forEach((param) => {
        const paramType = param.type as any;

        // Check if this is a @QueryParams() decorator
        const isQueryParams = param.parse === true && paramType && paramType !== Object;

        if (!paramType || paramType === Object) {
          // For @QueryParams() without proper type, keep the type but warn
          if (param.parse === true) {
            console.warn(`⚠️  @QueryParams() in ${param.object.name}.${param.method}() uses class "${paramType?.name || 'Object'}". ` + `Ensure this class has validation decorators (@IsString(), @IsNumber(), etc.) for OpenAPI generation.`);
          } else if (paramType === Object) {
            console.warn(`⚠️  Object type detected for parameter in ${param.object.name}.${param.method}() - ` + `parameter "${param.name || `index ${param.index}`}". Consider adding explicit type.`);
            // Force to String type to prevent OpenAPI generation errors
            (param as any).type = String;
          } else if (!paramType) {
            // Default to String type if not specified
            (param as any).type = String;
            console.warn(`🔧 Auto-patched parameter type to String: ${param.object.name}.${param.method}() - ` + `parameter ${param.name || `index ${param.index}`}`);
          }
        }

        // Special handling: if type is a class but not in schemas, create a basic schema
        if (paramType && typeof paramType === 'function') {
          const builtInTypes = [String, Number, Boolean, Date, Array, Object];
          const isBuiltIn = builtInTypes.some((t) => paramType === t);
          if (!isBuiltIn && paramType.name) {
            const className = paramType.name;
            if (!schemas[className]) {
              console.error(`🚨 CRITICAL: Schema missing for class "${className}" in ${param.object.name}.${param.method}(). ` + `Creating placeholder schema to prevent crash.`);
              // Create a more robust placeholder schema
              schemas[className] = {
                type: 'object',
                properties: {},
                additionalProperties: true,
                description: `Placeholder schema for ${className}. Add @IsString(), @IsNumber(), etc. decorators to class properties.`,
              };
            }
          }
        }
      });

      console.log('\n📝 Final schema count:', Object.keys(schemas).length);

      // Deep clean schemas to remove any null/undefined references
      console.log('\n🧹 Deep cleaning schemas...');
      const cleanSchema = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return { type: 'object' };
        }
        if (typeof obj !== 'object') {
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(cleanSchema);
        }
        const cleaned: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value !== null && value !== undefined) {
              cleaned[key] = cleanSchema(value);
            }
          }
        }
        return cleaned;
      };

      // Clean all schemas
      Object.keys(schemas).forEach((key) => {
        schemas[key] = cleanSchema(schemas[key]);
      });

      console.log('✅ Schema cleaning completed');

      // Additional diagnostic: Check all query/queries parameters
      console.log('\n🔍 Checking query parameters in detail...');
      const ensureSchema = (typeName: string) => {
        if (!schemas[typeName]) {
          console.warn(`  ⚠️  Creating emergency schema for: ${typeName}`);
          schemas[typeName] = {
            type: 'object',
            properties: {},
            additionalProperties: true,
            description: `Auto-generated placeholder for ${typeName}`,
          };
        }
      };

      storage.params.forEach((param) => {
        const paramAny = param as any;
        // Check for @QueryParam or @QueryParams
        if (param.name === 'query' || param.name === 'queries' || param.parse === true) {
          const paramType = paramAny.explicitType || paramAny.type;
          const typeName = typeof paramType === 'function' ? paramType.name : String(paramType);
          console.log(`📋 Query param in ${param.object.name}.${param.method}(): ` + `name="${param.name}", type="${typeName}", parse=${param.parse}, ` + `explicitType=${paramAny.explicitType?.name || 'none'}`);

          // Check if schema exists for this type
          if (typeof paramType === 'function' && paramType.name) {
            const builtInTypes = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Object'];
            if (!builtInTypes.includes(paramType.name)) {
              ensureSchema(paramType.name);
              if (schemas[paramType.name]) {
                console.log(`  ✅ Schema exists for ${paramType.name}`);
                const schemaStr = JSON.stringify(schemas[paramType.name], null, 2);
                console.log(`  📄 Schema preview:`, schemaStr.substring(0, 200) + '...');
              }
            }
          }
        }
      });

      // Final sweep: ensure ALL parameter types have schemas
      console.log('\n🔍 Final sweep - ensuring all parameter types have schemas...');
      storage.params.forEach((param) => {
        const paramType = (param as any).type || (param as any).explicitType;
        if (paramType && typeof paramType === 'function' && paramType.name) {
          const builtInTypes = ['String', 'Number', 'Boolean', 'Date', 'Array', 'Object'];
          if (!builtInTypes.includes(paramType.name)) {
            ensureSchema(paramType.name);
          }
        }
      });

      console.log(`\n📝 Final schema count after all checks: ${Object.keys(schemas).length}`);

      // Debug: Print all schema keys to help identify issues
      console.log('\n📋 All schema keys:', Object.keys(schemas).join(', '));

      // Validate schema structure
      console.log('\n🔍 Validating schema structure...');
      let validSchemaCount = 0;
      for (const key in schemas) {
        if (Object.prototype.hasOwnProperty.call(schemas, key)) {
          const schema = schemas[key];
          if (schema === null || schema === undefined) {
            console.error(`❌ NULL SCHEMA FOUND for key: ${key}`);
            schemas[key] = { type: 'object', properties: {}, additionalProperties: true };
          } else if (typeof schema !== 'object') {
            console.error(`❌ INVALID SCHEMA TYPE for key: ${key} (${typeof schema})`);
            schemas[key] = { type: 'object', properties: {}, additionalProperties: true };
          } else {
            validSchemaCount++;

            // Deep validate properties
            if (schema.properties) {
              for (const propKey in schema.properties) {
                if (Object.prototype.hasOwnProperty.call(schema.properties, propKey)) {
                  const prop = schema.properties[propKey];
                  if (prop === null || prop === undefined) {
                    console.error(`  ❌ NULL PROPERTY in ${key}.${propKey}`);
                    schema.properties[propKey] = { type: 'string' };
                  } else if (prop.$ref === null || (prop.$ref === undefined && prop.$ref !== undefined)) {
                    console.error(`  ❌ NULL $ref in ${key}.${propKey}`);
                    delete schema.properties[propKey].$ref;
                    schema.properties[propKey].type = 'string';
                  }
                }
              }
            }
          }
        }
      }
      console.log(`✅ ${validSchemaCount} valid schemas found`);

      // Ensure all schemas have required OpenAPI 3.0 structure
      console.log('\n🔧 Normalizing all schemas to OpenAPI 3.0 format...');
      for (const key in schemas) {
        if (Object.prototype.hasOwnProperty.call(schemas, key)) {
          const schema = schemas[key];

          // Skip primitive type schemas
          if (['String', 'Number', 'Boolean', 'Date', 'Object', 'Array'].includes(key)) {
            continue;
          }

          // Ensure schema has required fields
          if (schema.type === 'object' && schema.properties) {
            // Add required array if not present
            if (!schema.required) {
              schema.required = [];
            }

            // Ensure all properties are objects
            for (const propKey in schema.properties) {
              if (Object.prototype.hasOwnProperty.call(schema.properties, propKey)) {
                const prop = schema.properties[propKey];
                if (typeof prop !== 'object' || prop === null) {
                  console.warn(`  ⚠️  Fixing invalid property ${key}.${propKey}`);
                  schema.properties[propKey] = { type: 'string' };
                }
              }
            }
            console.log(`  ✅ Normalized: ${key}`);
          }
        }
      }

      // Building routing options for documentation generation
      const routingOptions: RoutingControllersOptions = {
        routePrefix: svcPath,
        controllers: filteredControllers,
      };

      routingOptions.controllers?.push(HealthCheckController as any);

      // CRITICAL FIX: Directly patch routing-controllers metadata before calling routingControllersToSpec
      console.log('\n🔧 Patching metadata storage...');
      let patchCount = 0;
      storage.params.forEach((param, index) => {
        const paramAny = param as any;

        // Fix 1: Ensure type exists
        if (!paramAny.type) {
          paramAny.type = String;
          patchCount++;
        }

        // Fix 2: Ensure explicitType exists if it should
        if (paramAny.explicitType === null || paramAny.explicitType === undefined) {
          if (paramAny.type && paramAny.type !== Object && typeof paramAny.type === 'function') {
            paramAny.explicitType = paramAny.type;
          }
        }

        // Fix 3: Remove any null/undefined values from param metadata
        for (const key in paramAny) {
          if (paramAny[key] === null || paramAny[key] === undefined) {
            if (key !== 'required' && key !== 'index' && key !== 'name') {
              delete paramAny[key];
              patchCount++;
            }
          }
        }
      });
      console.log(`✅ Patched ${patchCount} metadata issues\n`);

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

        console.log('✅ OpenAPI spec generated successfully\n');
      } catch (error) {
        console.error('\n❌ Error generating OpenAPI spec:', error);
        console.error('💡 Tip: Add validation decorators (@IsString(), @IsNumber(), etc.) to all controller parameters\n');
      }
    }
  };

  // Setting up OpenAPI documentation
  setupOpenAPI();

  // Starting server (if needed)
  if (!option.noListening) {
    return new Promise((resolve) => {
      server.listen(cfg.port, () => {
        resolve(server);
      });
    });
  }
};
