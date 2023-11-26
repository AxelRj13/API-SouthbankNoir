/**
 * Staging environment settings
 * (sails.config.*)
 *
 * This is mostly a carbon copy of the production environment settings
 * in config/env/production.js, but with the overrides listed below.
 * For more detailed information and links about what these settings do
 * see the production config file.
 *
 * > This file takes effect when `sails.config.environment` is "staging".
 * > But note that NODE_ENV should still be "production" when lifting
 * > your app in the staging environment.  In other words:
 * > ```
 * >     NODE_ENV=production sails_environment=staging node app
 * > ```
 *
 * If you're unsure or want advice, stop by:
 * https://sailsjs.com/support
 */

var PRODUCTION_CONFIG = require('./production');
//--------------------------------------------------------------------------
// /\  Start with your production config, even if it's just a guess for now,
// ||  then configure your staging environment afterwards.
//     (That way, all you need to do in this file is set overrides.)
//--------------------------------------------------------------------------

module.exports = Object.assign({}, PRODUCTION_CONFIG, {

  datastores: {
    default: {
      adapter: 'sails-postgresql',
      url: 'postgresql://deniel:Nerrazurri7@206.189.39.51:5432/staging-southbanknoir'
    }
  },
  imagePath: 'http://southbank.dn7store.com/upload/img/',
  sailsImagePath: 'http://206.189.39.51/images/',
  port: 8888,
  paymentSnapURL: 'https://app.sandbox.midtrans.com/snap/v1/',
  paymentAPIURL: 'https://api.sandbox.midtrans.com/v2/',
  paymentRedirectURL: 'https://app.sandbox.midtrans.com/snap/v3/redirection/',
  serverKeyBase64: 'U0ItTWlkLXNlcnZlci1CYVRRNnh4SEFIWlBPZTBMRjYtbXVrRWI6'
});
