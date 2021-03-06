const fs = require('fs-extra');
const { inspect } = require('util');

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-i18n-static',
  label: 'Phrase',
  pluralLabel: 'Phrases',
  seo: false,
  personas: false,
  sitemap: false,
  moogBundle: {
    modules: [ 'apostrophe-i18n-templates' ],
    directory: 'lib/modules'
  },

  beforeConstruct(self, options) {
    options.addFields = [
      {
        name: 'lang',
        label: 'Language',
        type: 'select',
        choices: 'getLocales',
        required: true,
        disabled: options.disableLocaleChange
      },
      {
        name: 'key',
        label: 'Key',
        type: 'string',
        required: true,
        disabled: options.disabledKey || false
      },
      {
        name: 'valueSingular',
        label: 'Singular Value',
        type: 'string',
        required: true
      },
      {
        name: 'valuePlural',
        label: 'Plural Value',
        type: 'string'
      },
      ...(options.addFields || [])
    ];

    options.removeFields = [ 'slug', 'tags', 'published', 'title', ...(options.removeFields || []) ];

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: [ 'lang', 'key', 'title', 'valueSingular', 'valuePlural', 'trash' ]
      },
      ...(options.arrangeFields || [])
    ];

    options.defaultColumns = [
      {
        name: 'lang',
        label: 'Language'
      },
      {
        name: 'key',
        label: 'Key'
      },
      {
        name: 'valueSingular',
        label: 'Singular Value'
      },
      {
        name: 'valuePlural',
        label: 'Plural Value'
      },
      ...(options.defaultColumns || [])
    ];

    options.addFilters = [
      {
        name: 'lang',
        label: 'Language',
        disableLocaleChange: options.disableLocaleChange
      },
      ...(options.addFilters || [])
    ];
  },

  construct(self, options) {

    self.getLocale = req => self.apos.modules['apostrophe-workflow'] ? req.locale.replace(/-draft$/, '') : req.locale;

    // need to populate "lang.choices" field with this function when apostrophe-workflow is used with "useWorkflowLocales" option
    self.getLocales = () => options.locales.sort((a, b) => a.label.localeCompare(b.label));

    const superPageBeforeSend = self.pageBeforeSend;
    self.pageBeforeSend = (req) => {
      req.browserCall('window.locale=?', self.getLocale(req));
      superPageBeforeSend(req);
    };

    self.beforeInsert = (req, piece, options, callback) => {
      piece.title = piece.key;
      piece.published = true;
      piece.slug = self.apos.utils.slugify(piece.key + '-' + piece.lang);

      return callback();
    };

    self.afterSave = async (req, piece, options, callback) => {
      return self.updateGeneration(req, piece, callback);
    };

    self.updateGeneration = async function(req, piece, callback) {
      try {
        // update global doc with random number to compare it with the next req
        // see expressMiddleware in this file
        const i18nGeneration = self.apos.utils.generateId();
        const query = { type: 'apostrophe-global' };

        if (self.apos.modules['apostrophe-workflow']) {
          query.workflowLocale = {
            $in: [
              piece.lang, piece.lang + '-draft'
            ]
          };
        }
        await self.apos.docs.db.updateMany(query, { $set: { i18nGeneration } });
        await self.db.update({
          _id: piece.lang
        }, {
          translations: {}
        }, { upsert: true });
        return callback();
      } catch (error) {
        return callback(error);
      }
    };

    self.expressMiddleware = async (req, res, next) => {

      // Apply super pattern to i18n methods of req and res so that
      // calls made directly on them still find the right localizations
      const methods = [ '__ns', '__ns_n', '__ns_mf', '__ns_l', '__ns_h', '__', '__n', '__mf', '__l', '__h' ];
      for (const name of methods) {
        const _super = req[name];
        req[name] = function(...args) {
          const savedLocale = req.locale;
          req.locale = self.apos.modules['apostrophe-i18n-static'].getLocale(req);
          const result = _super.apply(req, args);
          req.locale = savedLocale;
          return result;
        };
      }
      for (const name of methods) {
        const _super = res[name];
        res[name] = function(...args) {
          const savedLocale = res.locale;
          // yes, req is correct in call to getLocale
          res.locale = self.apos.modules['apostrophe-i18n-static'].getLocale(req);
          const result = _super.apply(res, args);
          res.locale = savedLocale;
          return result;
        };
      }

      // compare i18n number in req and in global
      // if they don't match, it means a language had a translation piece edited
      // so need to reload this i18n language file
      const locale = self.getLocale(req);
      self.lastI18nGeneration = self.lastI18nGeneration || {};
      req.data.global.i18nGeneration = (typeof req.data.global.i18nGeneration === 'string') ? req.data.global.i18nGeneration : '';
      if (options.autoReload && self.lastI18nGeneration[locale] !== req.data.global.i18nGeneration) {
        await saveI18nFile({
          locale,
          ...options
        });
      }
      self.lastI18nGeneration[locale] = req.data.global.i18nGeneration;
      next();
    };

    async function saveI18nFile(argv) {
      if (argv.locale) {
        try {
          if (argv.verbose) {
            console.time(`${argv.locale} done in`);
            console.log('Generating i18n file for', inspect(argv.locale, { colors: true }));
          }

          const record = await self.db.findOne({ _id: argv.locale });
          let translations = (record && record.translations) || {};
          const localesDir = self.apos.modules['apostrophe-i18n'].options.directory;
          const file = localesDir + '/' + argv.locale + '.json';
          await fs.ensureFile(file);

          if (Object.entries(translations).length === 0) {
            const req = self.apos.tasks.getAnonReq();
            const pieces = await self
              .find(req, {
                published: true,
                lang: argv.locale
              }, {
                key: 1,
                valueSingular: 1,
                valuePlural: 1
              })
              .toArray();
            translations = translatePieces(pieces);

            if (Object.entries(translations).length) { // avoid duplicate key error if empty
              await self.db.update({ _id: argv.locale }, { translations }, { upsert: true });
            }
          }

          // avoid simultaneous writing with apostrophe lock
          await self.apos.locks.withLock(
            `apostrophe-i18n:${argv.locale}`,
            async () => fs.writeJson(file, translations, { spaces: 2 })
          );

          if (argv.verbose) {
            console.timeEnd(`${argv.locale} done in`);
          }
        } catch (error) {
          if (!error.message.match(/lock apostrophe-i18n:/)) {
            console.error(error.message);
          }
        }
      }
    }

    function translatePieces(pieces) {
      function nest(obj, keys, val) {
        const key = keys.shift();
        if (key) {
          obj[key] = keys.length ? nest(obj[key] || {}, keys, val) : val;
        }
        return obj;
      };
      const result = pieces.reduce((acc, cur) => {
        const keys = options.objectNotation ? cur.key.split(options.objectNotation) : [ cur.key ];

        if (cur.valuePlural) {
          return nest(acc, keys, {
            one: cur.valueSingular,
            other: cur.valuePlural
          });
        } else {
          return nest(acc, keys, cur.valueSingular);
        }
      }, {});
      return result;
    }

    function flattenedLocales(parentLocales = [], flattenedLocalesArray = []) {
      for (const parentLocale of parentLocales) {
        flattenedLocalesArray.push({
          label: parentLocale.label,
          value: parentLocale.name
        });
        if (parentLocale.children) {
          flattenedLocalesArray = flattenedLocales(parentLocale.children, flattenedLocalesArray);
        }
      }
      return flattenedLocalesArray;
    }

    // wait for "modulesReady" event to reconfigure apostrophe-i18n
    self.on('apostrophe:modulesReady', 'configure', function() {
      const defaults = {
        autoReload: true,
        disabledKey: false,
        objectNotation: false,
        generateAtStartup: true,
        useWorkflowLocales: false,
        disableLocaleChange: false
      };
      options = Object.assign({}, defaults, options);

      if (options.objectNotation === true) { // important: only when boolean "true"
        options.objectNotation = '.';
      }

      const workflow = self.apos.modules['apostrophe-workflow'];
      if (workflow && options.useWorkflowLocales) {
        options.locales = flattenedLocales(workflow.options.locales);
      }

      const { apos, ...apostropheI18nOptions } = self.apos.modules['apostrophe-i18n'].options;
      const i18nOptions = {
        ...apostropheI18nOptions,
        indent: '  ',
        autoReload: options.autoReload,
        defaultLocale: options.defaultLocale,
        objectNotation: options.objectNotation,
        locales: options.locales.map(lang => lang.value),
        // Not the job of the i18n module anymore. We
        // take care of spotting new phrases and writing
        // new JSON files
        updateFiles: false
      };
      self.apos.i18n.configure(i18nOptions);
    });

    // Before we generate the JSONs, we need to exclude the type from workflow,
    // or the queries will fail
    self.on('apostrophe:modulesReady', 'excludeType', () => {
      const workflow = self.apos.modules['apostrophe-workflow'];
      if (workflow) {
        workflow.excludeTypes.push(self.name);
      }
    });

    self.on('apostrophe:modulesReady', 'generateJSONs', async function() {
      if (options.generateAtStartup) {
        if (options.verbose) {
          console.time('Total time');
        }
        for (const lang of options.locales) {
          await saveI18nFile({
            locale: lang.value,
            verbose: options.verbose
          });
        }
        if (options.verbose) {
          console.timeEnd('Total time');
        }
      }
    });

    // Establish the new index first so we have unique key coverage
    // before we remove the inefficient one
    self.on('apostrophe:migrate', 'createEfficientIndex', function () {
      return self.apos.docs.db.createIndex({
        lang: 1,
        key: 1
      }, {
        unique: true,
        partialFilterExpression: { type: self.name }
      });
    });

    self.on('apostrophe:migrate', 'removeInefficientIndex', async () => {
      try {
        await self.apos.docs.db.dropIndex('key_1_lang_1');
      } catch (e) {
        // This is OK, it means the inefficient legacy index never existed
        // in this particular project
      }
    });

    self.addTask(
      'reload',
      'Reload i18n file, usage "node app apostrophe-i18n-static:reload --locale=xx-XX"',
      (apos, argv) => saveI18nFile(argv)
    );

    self.addTask('reload-all', 'Reload all i18n files', async () => {
      console.time('Total time');
      for (const lang of options.locales) {
        await saveI18nFile({
          locale: lang.value,
          verbose: true
        });
      }
      console.timeEnd('Total time');
    });

    self.enableCollection = function(callback) {
      return self.apos.db.collection('aposI18nStaticTranslations', function(err, collection) {
        self.db = collection;
        return callback(err);
      });
    };

  },

  async afterConstruct(self, callback) {
    return self.enableCollection(callback);
  }
};
