const { inspect } = require('util');

module.exports = {
  improve: 'apostrophe-templates',
  construct: function(self, options) {
    const superI18n = self.i18n;
    const i18nContents = [];

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
        insertMissing();
      }
      return superI18n.apply(null, Array.prototype.slice.call(arguments));

      function findNestedKey(content, keys) {
        const key = keys.shift();
        const result = content.find(piece => piece.key === key);
        if (keys.length) {
          return findNestedKey(result || [], keys);
        } else {
          return result;
        }
      };

      async function insertMissing() {
        const locale = self.apos.modules['apostrophe-i18n-static'].getLocale(req);
        req.res.locale = locale; // for apostrophe-workflow: override locale in order to use translations from the currently displayed workflow locale
        let content = i18nContents[locale];
        if (!content) {
          i18nContents[locale] = await self.apos.modules['apostrophe-i18n-static'].find(req, {
            lang: locale
          }).areas(false).joins(false).toArray();
          content = i18nContents[locale];
        }

        req.body = req.body || {};
        req.body.filters = req.body.filters || {};
        if (!content.find(piece => piece.key === key) && !req.body.filters.search) {
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

          const piece = {
            key: key,
            title: key,
            lang: locale,
            published: true,
            valueSingular: defaultValue || key,
            type: 'apostrophe-i18n-static'
          };
          content.push(piece);

          if (operation === '__n') {
            Object.assign(piece, { valuePlural: defaultValue || key });
          }
          // Get an admin req so we can always insert phrases
          const _req = self.apos.tasks.getReq();
          self.apos.modules['apostrophe-i18n-static'].insert(_req, piece, { permissions: false }, (err, pieceAdded) => {
            if (err) {
              if (err.toString().match(/E11000/)) {
                if (self.apos.modules['apostrophe-i18n-static'].options.verbose) {
                  console.warn(`The JSON did not have ${pieceAdded.key} but the database already does`);
                }
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
    };
  }
};
