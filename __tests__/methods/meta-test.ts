import { Microservice } from '@lomray/microservice-nodejs-lib';
import { expect } from 'chai';
import rewiremock from 'rewiremock';
import OriginalMetaHandler from '@methods/meta';
import TypeormMock from '@mocks/typeorm';
import { endpointOptions } from '@test-helpers/index';

const { default: MetaHandler } = rewiremock.proxy<{
  default: typeof OriginalMetaHandler;
}>(() => require('@methods/meta'), {
  typeorm: TypeormMock.mock,
});

describe('methods/meta', () => {
  beforeEach(() => {
    TypeormMock.sandbox.reset();
  });

  const app = Microservice.create();

  it('should correctly return microservice metadata', async () => {
    const res = await MetaHandler('1.0.0')({}, { ...endpointOptions, app });

    expect(res).to.have.property('endpoints');
    expect(res).to.have.property('entities');
  });
});
