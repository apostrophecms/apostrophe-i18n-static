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

    var superRefresh = self.refresh;
    self.refresh = function(callback) {
      _.forEach(options.filters, function(filter) {
        if (filter.name === 'lang' && filter.disableLocaleChange) {
          setTimeout(function() {
            var $select = self.$filters.find('select[name="lang"]');
            $select.prop('disabled', true);
          }, 500);
        }
      });
      return superRefresh(callback);
    };
  }
});
