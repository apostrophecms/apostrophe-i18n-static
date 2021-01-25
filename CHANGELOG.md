# CHANGELOG


## 1.2.0 - 01-27-2021

* Collection used rather than cache to avoid issues when the database is shared between environments but the cache is not.

* One unique identifier per locale when saving translations, in order to work with apostrophe-workflow and reload only when necessary.

* Leaves database schema alone when starting up with migrations disabled.

* Disable `updateFiles` in the `i18n` npm module, as that is now our job and led to test failures and confusing behavior.

* The database, not the JSON files, is the source of truth for purposes of determining what phrases we have already seen. The i18n module or other sources may have previously created JSON files, this does not mean this module has corresponding pieces yet, so we must check our own knowledge.

* Use an admin `req` to insert phrase pieces, as normally an anonymous site visitor who happens to be the first to encounter a phrase would not be able to do that.

* Fully compatible with `apos.destroy`; waits for any outstanding piece inserts to complete before allowing destroy to continue, providing predictable behavior when shutting down in tests or elsewhere.

## 1.1.2 - 12-02-2020

Fixed "verbose" option while generating a file.

## 1.1.1 - 10-07-2020

Fixed possible duplication bug if `objectNotation` is true.

## 1.1.0 - 07-29-2020

Added option "verbose".

## 1.0.0

Initial release.

