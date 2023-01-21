import { expect } from 'chai';
import sinon from 'sinon';
import { ConnectionOptions } from 'typeorm';
import ConstantsMock from '@__mocks__/constants';
import GetConstants from '@helpers/get-constants';
import GetMsStartConfig from '@helpers/get-ms-start-config';

describe('helpers/get-ms-start-config', () => {
  const type = 'microservice';
  const msOptions = { name: 'ms-name' };
  const msParams = { logDriver: false };

  it('should correctly return microservice default config', () => {
    const { type: msType } = GetMsStartConfig(GetConstants(ConstantsMock), {
      type,
      msOptions,
      msParams,
    });

    expect(msType).to.equal(type);
  });

  it('should correctly return config with db', () => {
    const dbOptions: ConnectionOptions = { type: 'postgres' };
    const { shouldUseDbRemoteOptions } = GetMsStartConfig(
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
    const { registerEvents } = GetMsStartConfig(GetConstants(ConstantsMock), {
      type,
      msOptions,
      msParams,
      registerEvents: stub,
    });

    expect(registerEvents).to.not.equal(stub);
  });
});
