import fs from 'fs';
import { expect } from 'chai';
import rewiremock from 'rewiremock';
import sinon from 'sinon';
import type { ConnectionOptions } from 'typeorm';
import type OriginalCreateDbConnection from '@helpers/create-db-connection';
import { TypeormMock } from '@mocks/index';
import RemoteConfig from '@services/remote-config';

const { default: CreateDbConnection } = rewiremock.proxy<{
  default: typeof OriginalCreateDbConnection;
}>(() => require('@helpers/create-db-connection'), {
  typeorm: TypeormMock.mock,
  // '@helpers/create-db': TypeormExtensionMock.mock,
});

describe('helpers/create-db-connection', () => {
  const sandbox = sinon.createSandbox();
  const options: ConnectionOptions = { type: 'postgres', host: 'localhost', username: 'hello' };

  beforeEach(() => {
    TypeormMock.sandbox.reset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly create db connection', async () => {
    const writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');

    await CreateDbConnection(options, false);

    expect(writeFileSyncStub).to.calledOnceWith('ormconfig.json', JSON.stringify(options));
    expect(TypeormMock.stubs.createConnection).to.calledTwice;
  });

  it('should correctly create db connection with remote config', async () => {
    const writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');

    sandbox.stub(RemoteConfig, 'get').resolves({ host: 'localhost-test' });

    await CreateDbConnection(options, true);

    expect(writeFileSyncStub).to.calledOnceWith(
      'ormconfig.json',
      JSON.stringify({ ...options, host: 'localhost-test' }),
    );
    expect(TypeormMock.stubs.createConnection).to.calledTwice;
  });
});
