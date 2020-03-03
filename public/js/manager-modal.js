apos.define('apostrophe-i18n-static-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',
  source: 'manager-modal',

  construct: function(self, options) {
    var superGenerateFilter = self.generateFilter;
    self.generateFilter = function(filter) {
      if (filter.name === 'lang') {
        filter.def = window.locale;
      }
      return superGenerateFilter(filter);
    };

    var superAfterRefresh = self.afterRefresh;
    self.afterRefresh = function(callback) {
      _.forEach(options.filters, function(filter) {
        if (filter.name === 'lang' && filter.disableLocaleChange) {
          var $select = self.$filters.find('select[name="lang"]');
          $select.prop('disabled', true);
        }
      });
      return superAfterRefresh(callback);
    };
  }
});
