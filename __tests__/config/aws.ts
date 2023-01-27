import { Microservice } from '@lomray/microservice-nodejs-lib';
import { expect } from 'chai';
import sinon from 'sinon';
import ConstantsMock from '@__mocks__/constants';
import awsConfig from '@config/aws';
import getConstants from '@helpers/get-constants';
import RemoteConfig from '@services/remote-config';

describe('config/aws', () => {
  const sandbox = sinon.createSandbox();
  const constants = getConstants({ ...ConstantsMock, withAWS: true });

  before(() => {
    RemoteConfig.init(Microservice.create(), { isOffline: true, msConfigName: '', msName: '' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly return aws config: with remote', async () => {
    expect(await awsConfig(constants)).to.deep.equal({
      accessKeyId: '',
      secretAccessKey: '',
      region: '',
      s3: {
        bucketAcl: '',
        bucketName: '',
      },
    });
  });
});
