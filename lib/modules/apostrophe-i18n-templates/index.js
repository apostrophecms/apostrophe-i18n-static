const fs = require('fs-extra');
const { inspect } = require('util');

module.exports = {
  improve: 'apostrophe-templates',
  construct: function(self, options) {
    const superI18n = self.i18n;
    const i18nContents = {};

    self.i18n = function(req, operation, defaultKey) {
      const [key, defaultValue] = defaultKey.split(':');

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

        if (!content[key]) {
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
              console.error('Error while inserting apostrophe-i18n-static piece', err.message);
            } else {
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
    };
  }
};
