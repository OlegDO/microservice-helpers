import { RequiredOnlyProps } from '@lomray/client-helpers/interfaces/required-props';
import type { ConnectionOptions } from 'typeorm';
import type { ICommonConstants } from '@helpers/get-constants';

/**
 * Database connection options
 */
const getDbConfig = (
  { IS_BUILD, SRC_FOLDER, MS_WORKERS, DB }: RequiredOnlyProps<ICommonConstants, 'DB'>,
  extendPackageName?: string,
): ConnectionOptions => {
  const rootPath = SRC_FOLDER;
  const migrationPath = IS_BUILD ? 'lib/' : '';
  const packagePath = `node_modules/${extendPackageName || ''}`;

  const { URL, HOST, PORT, USERNAME, PASSWORD, DATABASE } = DB;

  const entities = [];
  const subscribers = [];
  const migrations = [];

  if (extendPackageName) {
    entities.push(`${packagePath}/entities/*.{ts,js}`);
    subscribers.push(`${packagePath}/subscribers/*.{ts,js}`);
    migrations.push(`${packagePath}/migrations/*.{ts,js}`);
  }

  entities.push(`${rootPath}/entities/*.{ts,js}`);
  subscribers.push(`${rootPath}/subscribers/*.{ts,js}`);
  migrations.push(`${migrationPath}migrations/*.{ts,js}`);

  return {
    type: 'postgres',
    ...((URL?.length ?? 0) > 0
      ? {
          url: URL,
        }
      : {
          host: HOST,
          port: PORT,
          username: USERNAME,
          password: PASSWORD,
          database: DATABASE,
        }),
    entities,
    subscribers,
    migrations,
    cli: {
      migrationsDir: `${migrationPath}migrations`,
      // we shouldn't work with this in production
      entitiesDir: `${rootPath}/entities`,
      subscribersDir: `${rootPath}/subscribers`,
    },
    extra: {
      max: MS_WORKERS * 2, // max pool size
      idleTimeoutMillis: 0, // disable auto-disconnection
    },
    migrationsRun: true,
    synchronize: false,
    logging: false,
  };
};

export default getDbConfig;
