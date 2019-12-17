apos.define('apostrophe-i18n-static-editor-modal', {
  extend: 'apostrophe-pieces-editor-modal',
  construct: function(self, options) {
    var superBeforeShow = self.beforeShow;
    self.beforeShow = function(callback) {
      options.schema.forEach(function(field) {
        if (field.disabled) {
          // disable visually a field markes as "disabled" in the schema to block modifications
          // done for the "key" field mostly
          var $name = apos.schemas.findField(self.$el, field.name);
          $name.attr('disabled', true);
        }
      });
      return superBeforeShow(callback);
    };
  }
});
