const fs = require('fs-extra');
const { inspect } = require('util');

module.exports = {
  extend: 'apostrophe-pieces',
  name: 'apostrophe-i18n-static',
  label: 'I18n static piece',
  pluralLabel: 'I18n static pieces',
  moogBundle: {
    modules: ['apostrophe-i18n-templates'],
    directory: 'lib/modules'
  },

  beforeConstruct(self, options) {
    options.addFields = [
      {
        name: 'lang',
        label: 'Language',
        type: 'select',
        choices: 'getLocales',
        required: true
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

    options.removeFields = ['slug', 'tags', 'published', 'title', ...(options.removeFields || [])];

    options.arrangeFields = [
      {
        name: 'basics',
        label: 'Basics',
        fields: ['lang', 'key', 'title', 'valueSingular', 'valuePlural']
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
        label: 'Language'
      },
      ...(options.addFilters || [])
    ];
  },

  async construct(self, options) {
    const i18nCache = self.apos.caches.get('i18n-static');

    self.getLocale = req => self.apos.modules['apostrophe-workflow'] ? req.locale.replace(/-draft$/, '') : req.locale;

    // need to populate "lang.choices" field with this function when apostrophe-workflow is used with "useWorkflowLocales" option
    self.getLocales = () => options.locales.sort(function (a, b) { return a.label.localeCompare(b.label); });

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
      try {
        // update global doc with random number to compare it with the next req
        // see expressMiddleware in this file
        const i18nGeneration = self.apos.utils.generateId();
        const query = { type: 'apostrophe-global' };

        if (self.apos.modules['apostrophe-workflow']) {
          query.workflowLocale = { $in: [piece.lang, piece.lang + '-draft'] };
        }
        await self.apos.docs.db.update(query, { $set: { i18nGeneration } }, { multi: true });
        await i18nCache.set(piece.lang, {});

        return callback();
      } catch (error) {
        return callback(error);
      }
    };

    self.expressMiddleware = async (req, res, next) => {
      // compare i18n number in req and in global
      // if they don't match, it means a language had a translation piece edited
      // so need to reload this i18n language file
      if (options.autoReload && self.lastI18nGeneration !== req.data.global.i18nGeneration) {
        const locale = self.getLocale(req);
        await saveI18nFile({ locale });
      }
      self.lastI18nGeneration = req.data.global.i18nGeneration;
      next();
    };

    async function saveI18nFile(argv) {
      if (argv.locale) {
        try {
          console.time(`${argv.locale} done in`);
          console.log('Generating i18n file for', inspect(argv.locale, { colors: true }));

          let translations = await i18nCache.get(argv.locale) || {};
          const localesDir = self.apos.modules['apostrophe-i18n'].options.directory;
          const file = localesDir + '/' + argv.locale + '.json';
          await fs.ensureFile(file);

          // create cache
          if (Object.entries(translations).length === 0) {
            const req = self.apos.tasks.getAnonReq();
            const pieces = await self
              .find(req, { published: true, lang: argv.locale }, { key: 1, valueSingular: 1, valuePlural: 1 })
              .toArray();
            translations = translatePieces(pieces);

            if (Object.entries(translations).length) { // avoid duplicate key error if empty
              await i18nCache.set(argv.locale, translations);
            }
          }

          // avoid simultaneous writing with apostrophe lock
          await self.apos.locks.withLock(
            `apostrophe-i18n:${argv.locale}`,
            async () => fs.writeJson(file, translations, { spaces: 2 })
          );
          console.timeEnd(`${argv.locale} done in`);
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

      return pieces.reduce((acc, cur) => {
        const keys = options.objectNotation ? cur.key.split(options.objectNotation) : [cur.key];

        if (cur.valuePlural) {
          return nest(acc, keys, { one: cur.valueSingular, other: cur.valuePlural });
        } else {
          return nest(acc, keys, cur.valueSingular);
        }
      }, {});
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
        useWorkflowLocales: false
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
        autoReload: options.autoReload,
        defaultLocale: options.defaultLocale,
        objectNotation: options.objectNotation,
        locales: options.locales.map(lang => lang.value)
      };
      self.apos.i18n.configure(i18nOptions);
    });

    self.on('apostrophe:modulesReady', 'generateJSONs', async function() {
      console.time('Total time');
      for (const lang of options.locales) {
        await saveI18nFile({ locale: lang.value });
      }
      console.timeEnd('Total time');
    });

    /* apostrophe-workflow exclusion start */
    self.on('apostrophe:modulesReady', 'excludeType', () => {
      const workflow = self.apos.modules['apostrophe-workflow'];
      if (workflow) {
        workflow.excludeTypes.push(self.name);
      }
    });
    /* apostrophe-workflow exclusion end */
  },

  async afterConstruct(self) {
    await self.apos.docs.db
      .createIndex({ key: 1, lang: 1 }, { unique: true, partialFilterExpression: { type: self.name } })
      .catch(error => console.error(error.message));
  }
};
