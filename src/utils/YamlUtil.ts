import fs from 'fs';
import yaml from 'js-yaml';
import { globSync } from 'glob';
import path from 'path';

const mergeJSON = require('merge-json');

const configFiles: string[] = [];


const find = (searchPath: string): string | undefined => {
  const targetWithExt = `${searchPath}.yml`;
  return configFiles.find((f) => {
    return f === targetWithExt || 
           f === targetWithExt.replace('./', '') ||
           path.normalize(f) === path.normalize(targetWithExt);
  });
};

export interface Config extends Record<string, unknown> {
  [key: string]: unknown;
}

export const loadConfig = (name: string): Config => {
  console.log('>>> loadConfig called with name:', name);
  
  if (configFiles.length === 0) {
    globSync('./cfg/*.yml').forEach((f: string) => configFiles.push(f));
  }
  //
  const environment = process.env.NODE_ENV;
  const zone = process.env.DEV_ZONE;
  const envConfigFile = `./cfg/${name}.${environment}`;
  const zoneConfigFile = `./cfg/${name}.${zone}`;
  const configFile = `./cfg/${name}`;
  
  let cfg: Config = {};
  const envFile = find(envConfigFile);
  if (envFile) {
    const envConfig = yaml.load(fs.readFileSync(envFile, 'utf8')) as Config;
    Object.assign(cfg, envConfig);
  }

  const zoneFile = find(zoneConfigFile);
  if (zoneFile) {
    const zoneConfig = yaml.load(fs.readFileSync(zoneFile, 'utf8')) as Config;
    Object.assign(cfg, zoneConfig);
  }
  //
  const file = find(configFile);
  if (file) {
    const config = yaml.load(fs.readFileSync(file, 'utf8')) as Config;
    cfg = mergeJSON.merge(cfg, config);
  }
  return cfg;
};