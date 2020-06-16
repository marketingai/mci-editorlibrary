const SCACommunicator = require('./index');
const testConfig = require('./test-config.js');
jest.setTimeout(60000);

if (!testConfig) throw new Error(`You require a valid test-config file. Follow the following format:\n${JSON.stringify({
  userKey: 'abc123.abc123'
}, null, 2)}`);
if (!testConfig.userKey) throw new Error('You need a valid userKey defined in your test-config.js file.');


test('Instantiating without a user key results in an error', () => {
  expect(() => new SCACommunicator()).toThrowError('Missing required userkey');
});

describe('Testing SCACommunicator observable methods', () => {
  let sca;
  beforeEach(() => {
    sca = new SCACommunicator({
      userKey: testConfig.userKey
    });
  });

  test('Testing SCACommunicator.on subscribe method', () => {
    sca.on('test', () => true);
    expect(sca.handlers['test']).toBeDefined();
  });

  test('Testing SCACommunicator.dispatch publish method', () => {
    const test = jest.fn();
    sca.on('test', test);
    sca.dispatch('test');
    expect(test).toHaveBeenCalledTimes(1);
  });
});

describe('Testing SCACommunicator use case setup operations:', () => {
  let sca;
  beforeEach(() => {
    sca = new SCACommunicator({
      userKey: testConfig.userKey
    });
  });

  test('Demos retrieved and HTML built', done => {
    sca.on('useCaseDemoFieldsSuccess', () => {
      expect(sca.HTMLFields).toBeDefined();
      expect(Object.keys(sca.HTMLFields).length).toBeGreaterThan(0);
      done();
    });
  });
});