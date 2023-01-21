import type { ConnectionOptions } from 'typeorm';
import type { ICommonConstants } from '@helpers/get-constants';

/**
 * Database connection options
 */
const getDbConfig = ({
  IS_BUILD,
  SRC_FOLDER,
  MS_WORKERS,
  DB,
}: ICommonConstants & Required<Pick<ICommonConstants, 'DB'>>): ConnectionOptions => {
  const rootPath = SRC_FOLDER;
  const migrationPath = IS_BUILD ? 'lib/' : '';

  const { URL, HOST, PORT, USERNAME, PASSWORD, DATABASE } = DB;

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
      max: MS_WORKERS * 2, // max pool size
      idleTimeoutMillis: 0, // disable auto-disconnection
    },
    migrationsRun: true,
    synchronize: false,
    logging: false,
  };
};

export default getDbConfig;
