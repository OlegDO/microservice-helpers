import type { LogDriverType } from '@lomray/microservice-nodejs-lib';
import { expect } from 'chai';
import sinon from 'sinon';
import ConstantsMock from '@__mocks__/constants';
import GetConstants from '@helpers/get-constants';
import { GetMsOptions, GetMsParams } from '@helpers/get-ms-config';
import Log from '@services/log';

describe('helpers/get-ms-config', () => {
  const sandbox = sinon.createSandbox();
  const constants = GetConstants(ConstantsMock);

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly return microservice options', () => {
    const { name, connection, isSRV, workers, version } = GetMsOptions(constants);

    expect(name).to.equal(constants.MS_NAME);
    expect(connection).to.equal(constants.MS_CONNECTION);
    expect(isSRV).to.equal(constants.IS_CONNECTION_SRV);
    expect(workers).to.equal(constants.MS_WORKERS);
    expect(version).to.equal(constants.VERSION);
  });

  it('should correctly return microservice params', () => {
    const logStub = sandbox.stub(Log, 'log');
    const message = 'hello';
    const params = GetMsParams();
    const logDriver = params.logDriver as LogDriverType;

    logDriver(() => message);

    const { args } = logStub.firstCall;

    expect(logStub).to.be.calledOnce;
    expect(args).to.deep.equal(['info', `${message} `]);
  });
});
