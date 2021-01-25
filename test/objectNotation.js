const fs = require('fs-extra');
const { expect } = require('chai');
const rp = require('request-promise');
const { promisify } = require('util');

let apos;

describe('Apostrophe-i18n-static', function() {

  after(async () => {
    const destroy = promisify(require('apostrophe/test-lib/util').destroy);
    const drain = promisify(apos.templates.i18nStaticFlush);
    await drain();
    await destroy(apos);
    fs.removeSync('./test/locales');
    fs.removeSync('./test/data');
  });

  // Treat this as a "test" so it runs sequentially, not in parallel, with
  // the "before" clause of other files
  it('should initialize app', (done) => {
    this.timeout(5000);
    apos = require('apostrophe')({
      testModule: true,
      modules: {
        'apostrophe-express': {
          csrf: false,
          session: {
            secret: 'test123'
          },
          port: 9999
        },
        'apostrophe-i18n-static': {
          objectNotation: true,
          defaultLocale: 'en-US',
          locales: [
            {
              label: 'English',
              value: 'en-US'
            },
            {
              label: 'French',
              value: 'fr-FR'
            }
          ]
        }
      },
      afterListen: function(err) {
        /* eslint-disable-next-line no-unused-expressions */
        expect(err).to.be.null;
        done();
      },
      shortName: 'i18n-test'
    });
  });

  describe('#object notation', function() {

    it('should convert object notation string to nested object in JSON file', async function () {
      const asyncReadFile = promisify(fs.readFile);

      // First request: starts inserting pieces in background
      await rp('http://localhost:9999/object');
      // Allow pieces to insert in background
      await sleep(1000);
      // Second request: triggers new JSON files
      await rp('http://localhost:9999/object');
      const file = JSON.parse(await asyncReadFile('./test/locales/en-US.json', { encoding: 'utf8' }));
      expect(file).to.have.deep.property('deep', { nested: { val: 'nested value' } });
    });
  });
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
