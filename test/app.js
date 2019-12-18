const apos = require('apostrophe')({
  modules: {
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
  shortName: 'i18n-test'
});

module.exports = apos;
