export interface ApplicationConfig {
  appName: string;
  version: string;
  port: number;
  privateKeyPath: string;
  publicKeyPath: string;
}

export interface DatabaseConfig {
  mariaDBUrl: string;
  output: string;
}

export interface RedisConfig {
  redis: string | any;
}
