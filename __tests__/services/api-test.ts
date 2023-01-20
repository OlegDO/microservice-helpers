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

    expect(Api).property('ms').to.equal(ms);
  });

  it('should correctly init client', () => {
    const client = Api.get();

    expect(client).to.instanceof(Endpoints);
  });
});
