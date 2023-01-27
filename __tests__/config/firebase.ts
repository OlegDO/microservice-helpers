import { Microservice } from '@lomray/microservice-nodejs-lib';
import { expect } from 'chai';
import sinon from 'sinon';
import ConstantsMock from '@__mocks__/constants';
import firebaseConfig from '@config/firebase';
import getConstants from '@helpers/get-constants';
import RemoteConfig from '@services/remote-config';

describe('config/firebase', () => {
  const sandbox = sinon.createSandbox();
  const constants = getConstants({ ...ConstantsMock, withFirebase: true });

  before(() => {
    RemoteConfig.init(Microservice.create(), { isOffline: true, msConfigName: '', msName: '' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly return aws config: with remote', async () => {
    expect(await firebaseConfig(constants)).to.deep.equal({
      credential: {},
    });
  });
});
