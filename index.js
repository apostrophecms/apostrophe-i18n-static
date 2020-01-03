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
        choices: options.locales,
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
        label: 'Language',
        def: options.defaultLocale
      },
      ...(options.addFilters || [])
    ];
  },

  async construct(self, options) {
    const defaults = {
      disabledKey: false,
      autoReload: true
    };
    options = Object.assign({}, defaults, options);

    const { apos, ...apostropheI18nOptions } = self.apos.modules['apostrophe-i18n'].options;
    const i18nOptions = {
      ...apostropheI18nOptions,
      autoReload: options.autoReload,
      locales: options.locales.map(lang => lang.value),
      defaultLocale: options.defaultLocale
    };
    self.apos.i18n.configure(i18nOptions);

    /* apostrophe-workflow exclusion start */
    self.on('apostrophe:modulesReady', 'excludeType', () => {
      const workflow = self.apos.modules['apostrophe-workflow'];
      if (workflow) {
        workflow.excludeTypes.push(self.name);
      }
    });
    /* apostrophe-workflow exclusion end */

    self.getLocale = req => self.apos.modules['apostrophe-workflow'] ? req.locale.replace(/-draft$/, '') : req.locale;

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
          query.workflowLocale = piece.lang;
        }
        await self.apos.docs.db.update(query, { $set: { i18nGeneration } });

        if (self.apos.modules['apostrophe-workflow']) {
          query.workflowLocale = piece.lang + '-draft';
          await self.apos.docs.db.update(query, { $set: { i18nGeneration } });
        }

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

    self.addTask(
      'reload',
      'Reload i18n file, usage "node app apostrophe-i18n-static:reload --locale=xx-XX"',
      (apos, argv) => saveI18nFile(argv)
    );

    self.addTask('reload-all', 'Reload all i18n files', async () => {
      console.time('Total time');
      for (const lang of options.locales) {
        await saveI18nFile({ locale: lang.value });
      }
      console.timeEnd('Total time');
    });

    async function saveI18nFile(argv) {
      if (argv.locale) {
        try {
          console.time(`${argv.locale} done in`);
          console.log('Generating i18n file for', inspect(argv.locale, { colors: true }));
          const localesDir = self.apos.modules['apostrophe-i18n'].options.directory;
          const file = localesDir + '/' + argv.locale + '.json';
          await fs.ensureFile(file);

          const req = self.apos.tasks.getAnonReq();
          const pieces = await self
            .find(req, { published: true, lang: argv.locale }, { key: 1, valueSingular: 1, valuePlural: 1 })
            .toArray();

          const translations = translatePieces(pieces);

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
      return pieces.reduce((acc, cur) => {
        if (cur.valuePlural) {
          acc[cur.key] = {
            one: cur.valueSingular,
            other: cur.valuePlural
          };
        } else {
          acc[cur.key] = cur.valueSingular;
        }
        return acc;
      }, {});
    }
  },

  async afterConstruct(self) {
    await self.apos.docs.db
      .createIndex({ key: 1, lang: 1 }, { unique: true, partialFilterExpression: { type: self.name } })
      .catch(error => console.error(error.message));
  }
};
