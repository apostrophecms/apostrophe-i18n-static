const fs = require('fs-extra');
const { expect } = require('chai');
const rp = require('request-promise');
const { promisify } = require('util');

let apos;
let req;

describe('Apostrophe-i18n-static', function() {

  after(async () => {
    const destroy = require('util').promisify(require('apostrophe/test-lib/util').destroy);
    await destroy(apos);
    fs.removeSync('./test/locales');
    fs.removeSync('./test/data');
  });

  describe('#no auto reload', function() {
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
            autoReload: false,
            disabledKey: true,
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
          req = apos.tasks.getReq();
          done();
        },
        shortName: 'i18n-test'
      });
    });
    it('should insert a piece', async function () {
      const asyncReadFile = promisify(fs.readFile);
      const asyncWriteFile = promisify(fs.writeFile);

      // add a value in JSON
      await asyncWriteFile('./test/locales/en-US.json', JSON.stringify({ test2: 'test' }));

      // modify the value in db
      await apos.modules['apostrophe-i18n-static'].insert(req, {
        lang: 'en-US',
        key: 'test2',
        valueSingular: 'test2'
      });

      // even after visiting a template, JSON is not generated due to "autoReload: false" option in apos
      // see configuration in appWithoutAutoReload.js
      await rp('http://localhost:9999');
      const file = JSON.parse(await asyncReadFile('./test/locales/en-US.json', { encoding: 'utf8' }));
      expect(file).to.not.have.property('test2', 'test');
    });
  });
});
