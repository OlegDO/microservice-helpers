import { expect } from 'chai';
import sinon from 'sinon';
import ConstantsMock from '@__mocks__/constants';
import firebaseConfig from '@config/firebase';
import getConstants from '@helpers/get-constants';
import RemoteConfig from '@services/remote-config';

describe('config/firebase', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly return aws config: without remote', async () => {
    process.env.FIREBASE_FROM_CONFIG_MS = '0';

    expect(
      await firebaseConfig(getConstants({ ...ConstantsMock, withFirebase: true })),
    ).to.deep.equal({
      credential: {},
    });
  });

  it('should correctly return aws config: with remote', async () => {
    process.env.FIREBASE_FROM_CONFIG_MS = '1';
    const config = { credential: { test: 1 } };

    sandbox.stub(RemoteConfig, 'get').resolves(config);

    expect(
      await firebaseConfig(getConstants({ ...ConstantsMock, withFirebase: true })),
    ).to.deep.equal({
      ...config,
    });
  });
});
