import { expect } from 'chai';
import sinon from 'sinon';
import ConstantsMock from '@__mocks__/constants';
import awsConfig from '@config/aws';
import getConstants from '@helpers/get-constants';
import RemoteConfig from '@services/remote-config';

describe('config/aws', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly return aws config: without remote', async () => {
    process.env.AWS_FROM_CONFIG_MS = '0';

    expect(await awsConfig(getConstants({ ...ConstantsMock, withAWS: true }))).to.deep.equal({
      accessKeyId: '',
      secretAccessKey: '',
      region: '',
      s3: {
        bucketAcl: '',
        bucketName: '',
      },
    });
  });

  it('should correctly return aws config: with remote', async () => {
    process.env.AWS_FROM_CONFIG_MS = '1';
    const config = { accessKeyId: 'accessKeyId' };

    sandbox.stub(RemoteConfig, 'get').resolves(config);

    expect(await awsConfig(getConstants({ ...ConstantsMock, withAWS: true }))).to.deep.equal({
      ...config,
      secretAccessKey: '',
      region: '',
      s3: {
        bucketAcl: '',
        bucketName: '',
      },
    });
  });
});
