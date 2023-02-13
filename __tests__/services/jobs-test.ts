import { Microservice } from '@lomray/microservice-nodejs-lib';
import { expect } from 'chai';
import sinon from 'sinon';
import Jobs from '@services/jobs';

describe('services/jobs', () => {
  const sandbox = sinon.createSandbox();
  const ms = Microservice.create();
  const service = Jobs.init(ms);
  const name = 'test-name';
  const callback = () => ({ success: true });
  const fakeJob = { job: 1 };
  const getJobPath = (path = name) => ['job', path].join('.');

  afterEach(() => {
    sandbox.restore();
  });

  it("should throw error if service doesn't initialized", () => {
    sandbox.stub(Jobs, 'instance' as never).value(null);

    expect(() => Jobs.get()).to.throw();
  });

  it('should correctly add new job endpoint', () => {
    const msStub = sandbox.stub(ms, 'addEndpoint');

    service.addJobEndpoint(name, callback);

    expect(msStub).to.calledOnceWith(getJobPath(), callback);
  });

  it('should correctly replace existed job endpoint', () => {
    const msStub = sandbox.stub(ms, 'addEndpoint');

    sandbox.stub(service, 'hasJob').returns(true);

    service.addJobEndpoint(name, callback);

    expect(msStub).to.calledOnceWith(getJobPath(), callback);
  });

  it('should correctly remove existed job endpoint', () => {
    const msStub = sandbox.stub(ms, 'removeEndpoint');

    service.removeJobEndpoint(name);

    expect(msStub).to.calledOnceWith(getJobPath());
  });

  it('should correctly return jobs', () => {
    const jobs = { [getJobPath()]: fakeJob, 'not-job': fakeJob };

    sandbox.stub(ms, 'getEndpoints').returns(jobs as never);

    expect(service.getJobs()).to.deep.equal({ [getJobPath()]: fakeJob });
    expect(service.hasJob(name)).to.true;
  });
});
