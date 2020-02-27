apos.define('apostrophe-i18n-static-editor-modal', {
  extend: 'apostrophe-pieces-editor-modal',
  construct: function(self, options) {
    var superBeforeShow = self.beforeShow;
    self.beforeShow = function(callback) {
      options.schema.forEach(function(field) {
        if (field.disabled) {
          // disable visually a field marked as "disabled" in the schema to block modifications
          setTimeout(function() {
            var $name = apos.schemas.findField(self.$el, field.name);
            $name.prop('disabled', true);
          }, 500);
        }
      });
      return superBeforeShow(callback);
    };
  }
});
