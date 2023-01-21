import { expect } from 'chai';
import GetConstants from '@helpers/get-constants';

describe('helpers/get-constants', () => {
  it('should correctly return general constants', () => {
    const msName = 'default-ms-name';
    const {
      IS_BUILD,
      MS_NAME,
      VERSION,
      ENV,
      ENVIRONMENT,
      SRC_FOLDER,
      DB_ENV: { DATABASE },
    } = GetConstants({ IS_BUILD: false, MS_NAME_DEFAULT: msName, VERSION: '1.0.0' });

    expect(IS_BUILD).to.false;
    expect(MS_NAME).to.equal(msName);
    expect(VERSION).to.equal('1.0.0');
    expect(ENV).to.equal('tests');
    expect(ENVIRONMENT).to.equal('prod');
    expect(SRC_FOLDER).to.equal('src');
    expect(DATABASE).to.equal(`ms-${msName}`);
  });
});
