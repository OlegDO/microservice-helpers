import { expect } from 'chai';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import GetDbConfig from '@helpers/get-db-config';
import type { IDbConfig } from '@helpers/get-db-config';

describe('helpers/create-db-connection', () => {
  const options: IDbConfig = {
    host: 'localhost',
    username: 'hello',
    rootPath: '/path',
    port: 1234,
    migrationPath: '/migration',
    password: '123',
    workers: 2,
    database: 'db',
  };

  it('should correctly return db config', () => {
    const { extra } = GetDbConfig(options);

    expect(extra.max).to.equal(options.workers * 2);
    expect(extra.idleTimeoutMillis).to.equal(0);
  });

  it('should correctly return config with url', () => {
    const { url } = GetDbConfig({ ...options, url: 'url' }) as PostgresConnectionOptions;

    expect(url).to.equal('url');
  });
});
