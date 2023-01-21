import { expect } from 'chai';
import ConstantsMock from '@__mocks__/constants';
import GetConstants from '@helpers/get-constants';

describe('helpers/get-constants', () => {
  it('should correctly return general constants', () => {
    const { IS_BUILD, MS_NAME, VERSION, ENV, ENVIRONMENT, SRC_FOLDER, DB, AWS, FIREBASE } =
      GetConstants(ConstantsMock);

    expect(IS_BUILD).to.false;
    expect(MS_NAME).to.equal(ConstantsMock.msNameDefault);
    expect(VERSION).to.equal(ConstantsMock.version);
    expect(ENV).to.equal('tests');
    expect(ENVIRONMENT).to.equal('prod');
    expect(SRC_FOLDER).to.equal('src');
    expect(DB).to.undefined;
    expect(AWS).to.undefined;
    expect(FIREBASE).to.undefined;
  });

  it('should correctly return constants with db', () => {
    const {
      DB: { DATABASE },
    } = GetConstants({ ...ConstantsMock, withDb: true });

    expect(DATABASE).to.equal(`ms-${ConstantsMock.msNameDefault}`);
  });

  it('should correctly return constants with AWS', () => {
    const {
      AWS: { IS_FROM_CONFIG_MS },
    } = GetConstants({ ...ConstantsMock, withAWS: true });

    expect(IS_FROM_CONFIG_MS).to.true;
  });

  it('should correctly return constants with Firebase', () => {
    const {
      FIREBASE: { IS_FROM_CONFIG_MS },
    } = GetConstants({ ...ConstantsMock, withFirebase: true });

    expect(IS_FROM_CONFIG_MS).to.true;
  });
});
