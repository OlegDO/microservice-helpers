import type { ConnectionOptions } from 'typeorm';
import { createConnection } from 'typeorm';

/**
 * Create DB if not exist
 */
const createDbIfNotExists = async ({ database, ...options }: ConnectionOptions): Promise<void> => {
  const connection = await createConnection(options as ConnectionOptions);
  const result = await connection.manager.query(
    `SELECT * FROM pg_database WHERE lower(datname) = lower('${database as string}');`,
  );

  if (result?.length === 0) {
    await connection.manager.query(`CREATE DATABASE "${database as string}" WITH ENCODING 'UTF8'`);
  }

  await connection.close();
};

export default createDbIfNotExists;
