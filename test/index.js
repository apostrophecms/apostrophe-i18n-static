const fs = require('fs-extra');
const { expect } = require('chai');
const { promisify } = require('util');

let apos;
let req;

describe('Apostrophe-i18n-static', function() {
  after(function(done) {
    fs.remove('./test/locales').then(() => {
      fs.remove('./test/data').then(() => {
        require('apostrophe/test-lib/util').destroy(apos, done);
      }).catch(function(e) {
        /* eslint-disable no-unused-expressions */
        expect(e).to.be.null;
        // Quiet node's warning about an ignored rejection
        return null;
      });
    });
  });

  describe('#pieces', function() {
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
          expect(err).to.be.null;
          req = apos.tasks.getReq();
          done();
        },
        shortName: 'i18n-test'
      });
    });
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
        // Drop the standard slug index for this one test, which will also stop this in typical
        // cases because it also contains lang, but we're interested in knowing
        // if the hard stop we put in place is working
        const indexes = await apos.docs.db.indexes();
        const oldSlug = indexes.find(index => {
          return index.key && index.key.slug;
        });
        await apos.docs.db.dropIndex(oldSlug.name);
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
