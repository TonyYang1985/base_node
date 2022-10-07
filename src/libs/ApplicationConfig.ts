export interface ApplicationConfig {
  appName: string;
  version: string;
  port: number;
  privateKeyPath: string;
  publicKeyPath: string;
}

export interface DatabaseConfig {
  mariaDBUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redis: string | any;
  // where to store the generated files
  output: string;
}
