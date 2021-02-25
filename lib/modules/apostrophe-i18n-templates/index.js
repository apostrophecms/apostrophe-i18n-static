const { inspect } = require('util');

module.exports = {
  improve: 'apostrophe-templates',
  construct: function(self, options) {
    const superI18n = self.i18n;
    const i18nContents = [];
    let insertMissingCount = 0;

    // Apostrophe lacks a beforeDestroy event, and if we use a destroy
    // handler we can still have problems due to the apostrophe-db destroy
    // handler running first, so apply the super pattern to apos.destroy itself

    const superDestroy = self.apos.destroy;
    self.apos.destroy = function(callback) {
      return self.i18nStaticFlush(err => {
        if (err) {
          return callback(err);
        }
        return superDestroy(callback);
      });
    };

    // For clean shutdown
    self.i18nStaticFlush = async function(callback) {
      // eslint-disable-next-line no-unmodified-loop-condition
      while (insertMissingCount) {
        await sleep(100);
      }
      return callback(null);
    };

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
        insertMissingCount++;
        try {
          const locale = self.apos.modules['apostrophe-i18n-static'].getLocale(req);
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
                    console.warn(`The JSON did not have ${piece.key} but the database already does`);
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
        } finally {
          insertMissingCount--;
        }
      }
    };
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
