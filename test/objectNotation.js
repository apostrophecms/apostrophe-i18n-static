const fs = require('fs');
const del = require('del');
const mongo = require('mongodb');
const { expect } = require('chai');
const rp = require('request-promise');
const { promisify } = require('util');
const enableDestroy = require('server-destroy');

let apos;
before(function(done) {
  apos = require('./appWithObjectNotation.js');
  setTimeout(() => {
    done();
  }, 10000);
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
  describe('#object notation', function() {

    it('should convert object notation string to nested object in JSON file', async function () {
      const asyncReadFile = promisify(fs.readFile);

      await rp('http://localhost:3000/object');
      const file = JSON.parse(await asyncReadFile('./test/locales/en-US.json', { encoding: 'utf8' }));
      expect(file).to.have.deep.property('deep', { nested: { val: 'nested value' } });
    });
  });
});
