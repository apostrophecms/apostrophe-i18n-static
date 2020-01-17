const fs = require('fs');
const del = require('del');
const mongo = require('mongodb');
const { expect } = require('chai');
const rp = require('request-promise');
const { promisify } = require('util');
const enableDestroy = require('server-destroy');

let apos;
let req;
before(function(done) {
  apos = require('./appWithoutAutoReload.js');
  setTimeout(() => {
    req = apos.tasks.getReq();
    done();
  }, 5000);
});

after(async function() {
  const server = apos.app.listen();
  enableDestroy(server);
  server.destroy();

  const db = await mongo.MongoClient.connect('mongodb://localhost:27017/i18n-test');
  await db.dropDatabase();
  await del(['./test/locales', './test/data']);
});

describe('Apostrophe-i18n-static', function() {
  describe('#no auto reload', function() {

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
      await rp(`http://localhost:3000`);
      const file = JSON.parse(await asyncReadFile('./test/locales/en-US.json', { encoding: 'utf8' }));
      expect(file).to.have.property('test2', 'test');
    });
  });
});
