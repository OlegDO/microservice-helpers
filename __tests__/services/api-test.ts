import { Microservice } from '@lomray/microservice-nodejs-lib';
import Endpoints from '@lomray/microservices-client-api/endpoints';
import { expect } from 'chai';
import sinon from 'sinon';
import Api from '@services/api';

describe('services/api', () => {
  const sandbox = sinon.createSandbox();
  const ms = Microservice.create();

  afterEach(() => {
    sandbox.restore();
  });

  it('should correctly set microservice instance', () => {
    Api.init(ms);
    Api.init();

    expect(Api).property('instance').to.instanceof(Endpoints);
  });

  it('should correctly init client', () => {
    expect(Api.get()).to.instanceof(Endpoints);
  });
});
