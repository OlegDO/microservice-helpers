import { expect } from 'chai';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import GetConstants from '@helpers/get-constants';
import GetDbConfig from '@helpers/get-db-config';

describe('helpers/create-db-connection', () => {
  const msNameDefault = 'default-ms-name';
  const version = '1.0.0';
  const constants = GetConstants({ msNameDefault, version, withDb: true });

  it('should correctly return db config', () => {
    const { extra } = GetDbConfig(constants);

    expect(extra.max).to.equal(constants.MS_WORKERS * 2);
    expect(extra.idleTimeoutMillis).to.equal(0);
  });

  it('should correctly return config with url', () => {
    const { url } = GetDbConfig({
      ...constants,
      DB: { ...constants.DB, URL: 'url' },
    }) as PostgresConnectionOptions;

    expect(url).to.equal('url');
  });

  it('should correctly return config with extended package', () => {
    const packageName = '@lomray/microservices-users';
    const { entities, subscribers, migrations } = GetDbConfig(
      constants,
      packageName,
    ) as PostgresConnectionOptions;

    expect(entities?.length).to.equal(2);
    expect(entities?.[0] as string).to.contain(packageName);
    expect(subscribers?.length).to.equal(2);
    expect(subscribers?.[0] as string).to.contain(packageName);
    expect(migrations?.length).to.equal(2);
    expect(migrations?.[0] as string).to.contain(packageName);
  });
});
