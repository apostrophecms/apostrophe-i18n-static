const fs = require('fs-extra');
const { inspect } = require('util');

module.exports = {
  improve: 'apostrophe-templates',
  construct: function(self, options) {
    const superI18n = self.i18n;
    const i18nContents = {};

    self.i18n = function(req, operation, key) {
      let content = i18nContents[req.locale];

      if (!content) {
        const localesDir = self.apos.modules['apostrophe-i18n'].options.directory;
        content = fs.readJsonSync(localesDir + '/' + req.locale + '.json');

        // keep loaded i18n JSON files in memory
        i18nContents[req.locale] = content;
      }

      if (!Object.keys(content).includes(key)) {
        content[key] = key;
        const piece = {
          key: key,
          title: key,
          published: true,
          lang: req.locale,
          valueSingular: key,
          type: 'translation'
        };

        if (operation === '__n') {
          Object.assign(piece, { valuePlural: key });
        }

        self.apos.modules['apostrophe-i18n-pieces'].insert(req, piece, (err, pieceAdded) => {
          if (err) {
            console.error('Error while inserting translation piece', inspect(err.message, { colors: true }));
          } else {
            console.log(
              'New translation piece added',
              inspect(pieceAdded.key, { colors: true }),
              'for',
              inspect(req.locale, { colors: true })
            );
          }
        });
      }

      return superI18n.apply(null, Array.prototype.slice.call(arguments));
    };
  }
};
