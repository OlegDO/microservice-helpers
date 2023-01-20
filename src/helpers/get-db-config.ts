import { ConnectionOptions } from 'typeorm';

export interface IDbConfig {
  rootPath: string;
  migrationPath: string;
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  workers: number;
}

/**
 * Database connection options
 */
const getDbConfig = ({
  rootPath,
  migrationPath,
  workers,
  url,
  host,
  port,
  username,
  database,
  password,
}: IDbConfig): ConnectionOptions => ({
  type: 'postgres',
  ...((url?.length ?? 0) > 0
    ? {
        url,
      }
    : {
        host,
        port,
        username,
        password,
        database,
      }),
  entities: [`${rootPath}/entities/*.{ts,js}`],
  subscribers: [`${rootPath}/subscribers/*.{ts,js}`],
  migrations: [`${migrationPath}migrations/*.{ts,js}`],
  cli: {
    migrationsDir: `${migrationPath}migrations`,
    // we shouldn't work with this in production
    entitiesDir: `${rootPath}/entities`,
    subscribersDir: `${rootPath}/subscribers`,
  },
  extra: {
    max: workers * 2, // max pool size
    idleTimeoutMillis: 0, // disable auto-disconnection
  },
  migrationsRun: true,
  synchronize: false,
  logging: false,
});

export default getDbConfig;
