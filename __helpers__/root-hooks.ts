/* eslint-disable import/prefer-default-export */
// noinspection JSUnusedGlobalSymbols

import { Microservice } from '@lomray/microservice-nodejs-lib';
import sinon from 'sinon';
import Log from '@services/log';
import RemoteConfig from '@services/remote-config';

/**
 * Mocha root hooks
 */
export const mochaHooks = {
  beforeAll(): void {
    Log.configure({ silent: true });
    Log.transports.find((transport) => Log.remove(transport));
    RemoteConfig.init(Microservice.create(), { isOffline: true, msConfigName: '', msName: '' });
  },
  beforeEach(): void {
    if (!console.info?.['resetHistory']) {
      sinon.stub(console, 'info');
    }
  },
  afterAll(): void {
    sinon.restore();
  },
};
