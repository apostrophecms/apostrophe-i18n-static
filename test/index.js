const del = require('del');
const fs = require('fs-extra');
const mongo = require('mongodb');
const { expect } = require('chai');
const { promisify } = require('util');
const enableDestroy = require('server-destroy');

let apos;
let req;
before(async function() {
  await fs.ensureSymlink('./index.js', 'test/lib/modules/apostrophe-i18n-static/index.js');
  await fs.ensureSymlink('./lib/modules/apostrophe-i18n-templates/index.js', 'test/lib/modules/apostrophe-i18n-static/lib/modules/apostrophe-i18n-templates/index.js');
  apos = require('./app');
  setTimeout(() => (req = apos.tasks.getReq()), 5000);
});

after(async () => {
  const server = apos.app.listen();
  enableDestroy(server);
  server.destroy();

  const db = await mongo.MongoClient.connect('mongodb://localhost:27017/i18n-test');
  await db.dropDatabase();
  await del(['./test/locales', './test/data']);
});

describe('Apostrophe-i18n-static', function() {
  describe('#pieces', function() {
    it('should define locales of apostrophe-i18n', () => {
      const options = apos.modules['apostrophe-i18n-static'].options;
      const optionsLocales = options.locales.map(locale => locale.value);
      const i18nLocales = apos.i18n.getLocales();
      const i18nDefaultLocale = apos.i18n.getLocale();

      expect(options.defaultLocale).to.equal(i18nDefaultLocale);
      expect(optionsLocales).to.eql(i18nLocales);
    });

    it('should create an index', async() => {
      const indexes = await apos.docs.db.listIndexes().toArray();
      const indexExists = await apos.docs.db.indexExists('key_1_lang_1');
      const index = indexes.find(i => (i.name = 'key_1_lang_1' && i.partialFilterExpression));

      expect(indexExists).to.be.true; // eslint-disable-line no-unused-expressions
      expect(index).to.be.an('object').that.has.any.keys('unique', 'partialFilterExpression');
      expect(index.unique).to.be.true; // eslint-disable-line no-unused-expressions
      expect(index.partialFilterExpression.type).to.equal('apostrophe-i18n-static');
    });

    it('should insert a piece', async () => {
      const piece = await apos.modules['apostrophe-i18n-static'].insert(req, {
        lang: 'en-US',
        key: 'test',
        valueSingular: 'test'
      });
      const res = await apos.global.findGlobal(req);

      expect(piece.slug).to.equal('test-en-us');
      expect(res).to.be.an('object').that.has.any.keys('i18nGeneration');
    });

    it('should not insert a piece with same lang and key', async () => {
      try {
        await apos.modules['apostrophe-i18n-static'].insert(req, {
          lang: 'en-US',
          key: 'test',
          valueSingular: 'test'
        });
      } catch (error) {
        expect(error).to.match(/E11000 duplicate key error collection: i18n-test.aposDocs index: key_1_lang_1 dup key: { key: "test", lang: "en-US" }/);
      }
    });

    it('should create JSON files', async () => {
      const asyncReaddir = promisify(fs.readdir);
      const files = await asyncReaddir('./test/locales');
      expect(files).to.contain('en-US.json');
      expect(files).to.contain('fr-FR.json');
    });
  });
});
