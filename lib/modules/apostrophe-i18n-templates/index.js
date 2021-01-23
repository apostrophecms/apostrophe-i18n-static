const fs = require('fs-extra');
const { inspect } = require('util');

module.exports = {
  improve: 'apostrophe-templates',
  construct: function(self, options) {
    const superI18n = self.i18n;
    const i18nContents = {};

    self.i18n = function(req, operation, defaultKey) {
      let namespace = false;
      let key, defaultValue;
      if (operation.substring(0, 4) === '__ns') {
        namespace = defaultKey;
        [ key, defaultValue ] = arguments[3].split(':');
        const ignoreNamespaces = self.apos.modules['apostrophe-i18n-static'].options.ignoreNamespaces;
        if (ignoreNamespaces && ignoreNamespaces.includes(namespace)) {
          return superI18n.apply(null, Array.prototype.slice.call(arguments));
        } else {
          key = namespace + '<:>' + key;
        }
      } else {
        [ key, defaultValue ] = defaultKey.split(':');
      }

      if (key) {
        const locale = self.apos.modules['apostrophe-i18n-static'].getLocale(req);
        req.res.locale = locale; // for apostrophe-workflow: override locale in order to use translations from the currently displayed workflow locale
        let content = i18nContents[locale];

        if (!content) {
          const localesDir = self.apos.modules['apostrophe-i18n'].options.directory;
          content = fs.readJsonSync(localesDir + '/' + locale + '.json');
          // keep loaded i18n JSON files in memory
          i18nContents[locale] = content;
        }

        req.body = req.body || {};
        req.body.filters = req.body.filters || {};
        if (!content[key] && !req.body.filters.search) {
          if (self.apos.modules['apostrophe-i18n-static'].options.objectNotation) {
            // if key was not found, it could be because it is an object, not a simple string
            // for example, the key in db might be nested.deep.obj but in the JSON file, it will be
            // "deep": {
            //   "nested": {
            //       "obj": "deep nested value"
            //    }
            // }
            let objectNotation = self.apos.modules['apostrophe-i18n-static'].options.objectNotation;
            if (objectNotation === true) { // important: only when boolean "true"
              objectNotation = '.';
            }
            const keys = key.split(objectNotation);

            const existingNestedKey = findNestedKey(content, keys);
            if (existingNestedKey) {
              // if key was present in the JSON file but under different shape than in db
              // do not add it again to the db and exit
              return superI18n.apply(null, Array.prototype.slice.call(arguments));
            }
          }

          content[key] = key;
          const piece = {
            key: key,
            title: key,
            lang: locale,
            published: true,
            valueSingular: defaultValue || key,
            type: 'apostrophe-i18n-static'
          };

          if (operation === '__n') {
            Object.assign(piece, { valuePlural: defaultValue || key });
          }

          self.apos.modules['apostrophe-i18n-static'].insert(req, piece, { permissions: false }, (err, pieceAdded) => {
            if (err) {
              if (err.toString().match(/E11000/)) {
                // The database has it but the flat file does not. We still need
                // to trigger a regeneration of the flat file
                return self.apos.modules['apostrophe-i18n-static'].updateGeneration(req, piece, function(err) {
                  if (err) {
                    console.error('Error while updating generation for outdated flat file:', err);
                  }
                });
              } else {
                console.error('Error while inserting apostrophe-i18n-static piece', err.message);
              }
            } else if (self.apos.modules['apostrophe-i18n-static'].options.verbose) {
              console.log(
                'New apostrophe-i18n-static piece added',
                inspect(pieceAdded.key, { colors: true }),
                'for',
                inspect(locale, { colors: true })
              );
            }
          });
        }
      }

      return superI18n.apply(null, Array.prototype.slice.call(arguments));

      function findNestedKey(obj, keys) {
        const key = keys.shift();
        if (keys.length) {
          return findNestedKey(obj[key] || {}, keys);
        } else {
          return obj[key];
        }
      };
    };
  }
};
