<a id="contents"></a>

# Apostrophe i18n static

1. [Installation](#1)<br>
2. [Configuration](#2)<br>
3. [Usage in production](#3)<br>
4. [Usage with apostrophe-workflow](#4)<br>

This module adds editable pieces for translation through i18n to an Apostrophe project.

:warning: **Warning!!!** :warning:

It is intendend to localize static text in templates i.e text wrapped with `__("...')`, not localize editable content. If your goal is content localization, you should use the [Apostrophe workflow module](https://github.com/apostrophecms/apostrophe-workflow) instead.

I18n static pieces are excluded from apostrophe-workflow. To use both `apostrophe-i18n-static` and `apostrophe-workflow`, see [Usage with apostrophe-workflow](#4)

For static text localization, you are in the right place.

---

Pieces are edited in the module `apostrophe-i18n-static`. Then, JSON files are generated for the i18n module used in Apostrophe.

This will add an entry in the admin bar "I18n static" and pieces will have a schema with:
- language
- key
- value
- optional plural value matching i18n module

![schema](apostrophe-i18n-pieces-schema.png)

The first time a template containing a new string to translate through `__("...')` is rendered, the piece is created in the database. When the value of this piece is edited, the matching JSON file is recreated. Therefore, do **NOT** edit directly the JSON files.

<a id="1"></a>

## 1 Installation [&#x2B06;](#contents)

`npm i apostrophe-i18n-static`

<a id="2"></a>


## 2 Configuration [&#x2B06;](#contents)

The following options are mandatory:
- locales to edit, in an array with `label` and `value` fields
- a default locale (one of the locales)

```js
// app.js

require('apostrophe')({
  shortName: 'name-of-project',
  modules: {
    'apostrophe-i18n-static': {
      defaultLocale: 'en-US',
      locales: [
        {
          label: 'German',
          value: 'de-DE',
        },
        {
          label: 'English',
          value: 'en-US',
        },
        {
          label: 'Spanish',
          value: 'es-ES',
        },
        {
          label: 'French',
          value: 'fr-FR',
        }
      ]
    }
  }
})
```
This will create the corresponding JSON files in the `locales` folder of the project (or the `localesDir` defined in `apostrophe-i18n` module). The format of the locales can be anything (`en-US` in this example, but could have been `en` or other format fitting your needs).

Other options are:
- `disabledKey`: default `false`. When `true`, it will render the `key` field as "disabled" to inform users the key should not be modified.
- `autoReload`: default `true`. When `false`, it will not reload JSON files when a translation piece is edited.

Options from `apostrophe-i18n` module are taken into account, except `locales` and `defaultLocale`.

<a id="3"></a>

### 3 Usage in production [&#x2B06;](#contents)

As explained above, JSON files should not be edited directly because the reloading of i18n files is made after a translation piece has been edited. To be more accurate, if there are 2 JSON files (for example `en.json` and `fr.json`), if an `apostrophe-i18n-static` piece is edited for the `en` locale, only the `en.json` file will be regenerated.

Therefore, if one chooses to commit the JSON files into a Git repository to keep the latest translations, it is not mandatory as there are apostrophe tasks to recreate the JSON files (but Git `commit` can be a way to trace editions history if needed).

### 3.1 Apostrophe tasks

If files need to be regenerated, 2 tasks have been defined:

- `node app apostrophe-i18n-static:reload --locale=xx` where `xx` is a valid i18n file name. It generates only the file for the specified locale.
- `node app apostrophe-i18n-static:reload-all` finds every locale and generate files (see list of files in `locales` directory).

These tasks can be run during a server startup (or Docker build) to always have up-to-date translations.

### 3.2 Distributed system

This module has been designed to work with several running Apostrophe instances sharing the same DB (or a MongoDB sharded cluster). In a docker environnement, if a translation piece is edited on one instance, its JSON file is regenerated inside its container and a new random ID is stored into the DB. This way, the next request coming from the other instance will detect there was a change (due to the new random ID) and regenerate its JSON files too. As a consequence, translations are always up-to-date.

### 3.3 Performance

As a general idea, the regeneration of a file containing several hundred translations takes usually a few milliseconds. Every reload is measured and displayed on the standard output.


<a id="4"></a>

### 4 Usage with apostrophe-workflow [&#x2B06;](#contents)

Example of project configuration using `apostrophe-i18n-static` and `apostrophe-workflow` together:

```js
// app.js
const locales = [
  {
    label: 'German',
    value: 'de-DE',
  },
  {
    label: 'English',
    value: 'en-US',
  },
  {
    label: 'Spanish',
    value: 'es-ES',
  },
  {
    label: 'French',
    value: 'fr-FR',
  }
];

const defaultLocale = 'fr-FR';

require('apostrophe')({
  shortName: 'apostrophe-test',
  modules: {
    'apostrophe-i18n-static': {
      defaultLocale,
      locales
    },
    'apostrophe-workflow': {
      alias: 'workflow',
      locales: locales.map(locale => ({ label: locale.label, name: locale.value })),
      defaultLocale
    }
  }
});
```

The displayed translations will be taken from current worflow locale. For example, if the user is on the `es-ES` (or `es-ES-draft`) locale according to apostrophe-worflow, translations coming from `es-ES.json` will be displayed.
