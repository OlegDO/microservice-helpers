import { expect } from 'chai';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import ConstantsMock from '@__mocks__/constants';
import GetConstants from '@helpers/get-constants';
import GetDbConfig from '@helpers/get-db-config';

describe('helpers/create-db-connection', () => {
  const constants = GetConstants({ ...ConstantsMock, withDb: true });

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
    const extendPackageName = '@lomray/microservices-users';
    const { entities, subscribers, migrations } = GetDbConfig(
      constants,
      extendPackageName,
    ) as PostgresConnectionOptions;

    expect(entities?.length).to.equal(2);
    expect(entities?.[0] as string).to.contain(extendPackageName);
    expect(subscribers?.length).to.equal(2);
    expect(subscribers?.[0] as string).to.contain(extendPackageName);
    expect(migrations?.length).to.equal(2);
    expect(migrations?.[0] as string).to.contain(extendPackageName);
  });
});
