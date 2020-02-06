apos.define('apostrophe-i18n-static-manager-modal', {
  extend: 'apostrophe-pieces-manager-modal',
  source: 'manager-modal',

  construct: function(self, options) {
    self.generateFilter = function(filter) {
      if (filter.name === 'lang') {
        filter.def = window.locale;
      }

      return {
        name: filter.name,
        multiple: filter.multiple,
        setDefault: function() {
          self.currentFilters[filter.name] = filter.def;
        }
      };
    };
  }
});
