import { expect } from 'chai';
import GetConstants from '@helpers/get-constants';

describe('helpers/get-constants', () => {
  const msNameDefault = 'default-ms-name';
  const version = '1.0.0';

  it('should correctly return general constants', () => {
    const { IS_BUILD, MS_NAME, VERSION, ENV, ENVIRONMENT, SRC_FOLDER, DB, AWS, FIREBASE } =
      GetConstants({
        msNameDefault,
        version,
      });

    expect(IS_BUILD).to.false;
    expect(MS_NAME).to.equal(msNameDefault);
    expect(VERSION).to.equal(version);
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
    } = GetConstants({ msNameDefault, version, withDb: true });

    expect(DATABASE).to.equal(`ms-${msNameDefault}`);
  });

  it('should correctly return constants with AWS', () => {
    const {
      AWS: { IS_FROM_CONFIG_MS },
    } = GetConstants({ msNameDefault, version, withAWS: true });

    expect(IS_FROM_CONFIG_MS).to.true;
  });

  it('should correctly return constants with Firebase', () => {
    const {
      FIREBASE: { IS_FROM_CONFIG_MS },
    } = GetConstants({ msNameDefault, version, withFirebase: true });

    expect(IS_FROM_CONFIG_MS).to.true;
  });
});
