import { expect } from 'chai';
import sinon from 'sinon';
import { ConnectionOptions } from 'typeorm';
import ConstantsMock from '@__mocks__/constants';
import GetConstants from '@helpers/get-constants';
import GetMsConfig from '@helpers/get-ms-config';

describe('helpers/get-ms-config', () => {
  const type = 'microservice';
  const msOptions = { name: 'ms-name' };
  const msParams = { logDriver: false };

  it('should correctly return microservice default config', () => {
    const { type: msType } = GetMsConfig(GetConstants(ConstantsMock), {
      type,
      msOptions,
      msParams,
    });

    expect(msType).to.equal(type);
  });

  it('should correctly return config with db', () => {
    const dbOptions: ConnectionOptions = { type: 'postgres' };
    const { shouldUseDbRemoteOptions } = GetMsConfig(
      GetConstants({ ...ConstantsMock, withDb: true }),
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
    const { registerEvents } = GetMsConfig(GetConstants(ConstantsMock), {
      type,
      msOptions,
      msParams,
      registerEvents: stub,
    });

    expect(registerEvents).to.not.equal(stub);
  });
});
