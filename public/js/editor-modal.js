apos.define('apostrophe-i18n-static-editor-modal', {
  extend: 'apostrophe-pieces-editor-modal',
  construct: function(self, options) {
    var superAfterShow = self.afterShow;
    self.afterShow = function() {
      options.schema.forEach(function(field) {
        if (field.disabled) {
          // disable visually a field marked as "disabled" in the schema to block modifications
          var $name = apos.schemas.findField(self.$el, field.name);
          $name.prop('disabled', true);
        }
      });
      return superAfterShow();
    };
  }
});
