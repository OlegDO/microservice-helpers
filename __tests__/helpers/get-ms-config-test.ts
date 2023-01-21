import { expect } from 'chai';
import sinon from 'sinon';
import { ConnectionOptions } from 'typeorm';
import GetConstants from '@helpers/get-constants';
import GetMsConfig from '@helpers/get-ms-config';

describe('helpers/get-ms-config', () => {
  const msNameDefault = 'default-ms-name';
  const version = '1.0.0';
  const type = 'microservice';
  const msOptions = { name: 'ms-name' };
  const msParams = { logDriver: false };

  it('should correctly return microservice default config', () => {
    const { type: msType } = GetMsConfig(GetConstants({ msNameDefault, version }), {
      type,
      msOptions,
      msParams,
    });

    expect(msType).to.equal(type);
  });

  it('should correctly return config with db', () => {
    const dbOptions: ConnectionOptions = { type: 'postgres' };
    const { shouldUseDbRemoteOptions } = GetMsConfig(
      GetConstants({ msNameDefault, version, withDb: true }),
      {
        type,
        msOptions,
        msParams,
        dbOptions,
      },
    );

    expect(shouldUseDbRemoteOptions).to.true;
  });

  it('should correctly return config with register events', () => {
    const stub = sinon.stub();
    const { registerEvents } = GetMsConfig(GetConstants({ msNameDefault, version }), {
      type,
      msOptions,
      msParams,
      registerEvents: stub,
    });

    expect(registerEvents).to.not.equal(stub);
  });
});
