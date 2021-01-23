const fs = require('fs-extra');
const { expect } = require('chai');
const rp = require('request-promise');
const { promisify } = require('util');

let apos;

describe('Apostrophe-i18n-static', function() {

  after(function(done) {
    fs.remove('./test/locales').then(() => {
      fs.remove('./test/data').then(() => {
        require('apostrophe/test-lib/util').destroy(apos, done);
      }).catch(function(e) {
        /* eslint-disable no-unused-expressions */
        expect(e).to.be.null;
      });
    });
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
          port: 3000
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
        expect(err).to.be.null;
        done();
      },
      shortName: 'i18n-test'
    });
  });

  describe('#object notation', function() {

    it('should convert object notation string to nested object in JSON file', async function () {
      const asyncReadFile = promisify(fs.readFile);

      await rp('http://localhost:3000/object');
      const file = JSON.parse(await asyncReadFile('./test/locales/en-US.json', { encoding: 'utf8' }));
      expect(file).to.have.deep.property('deep', { nested: { val: 'nested value' } });
    });
  });
});
