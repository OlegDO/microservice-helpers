import { expect } from 'chai';
import RedactSecrets from '@helpers/redact-secrets';

describe('helpers/redact-secrets', () => {
  const redacted = '[REDACTED]';

  it('should correctly replace secrets values in string', () => {
    const testCircular = { a: {} };

    testCircular.a = testCircular;

    const cases = [
      // test circular object input
      { input: { refresh: '12345', testCircular }, output: { refresh: redacted, testCircular } },
      { input: { password: '1235' }, output: { password: redacted } },
      { input: { deep: { password: '1235' } }, output: { deep: { password: redacted } } },
      {
        input: {
          test: 'not-private',
          deep: { 'api-key': '1235', 'private-key': '3456' },
          access: 'token',
          test2: '12345',
        },
        output: {
          test: 'not-private',
          deep: { 'api-key': redacted, 'private-key': redacted },
          access: redacted,
          test2: '12345',
        },
      },
      {
        input: {
          json: '{"test1":"12345","authorization":"Bearer token","test2":"6789","cookie":"12345","cardNumber":"4611-0133-7357-0049"}',
        },
        output: {
          json: `{"test1":"12345","authorization":"${redacted}","test2":"6789","cookie":"${redacted}","cardNumber":"${redacted}"}`,
        },
      },
    ];

    for (const { input, output } of cases) {
      const res = RedactSecrets(input);

      expect(res).to.deep.equal(output);
    }
  });
});
