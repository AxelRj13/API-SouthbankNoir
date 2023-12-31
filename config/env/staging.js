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
      url: 'postgresql://southbanknoir:z#PU~52zA)xYw@d@128.199.155.9:5432/staging-southbanknoir'
    }
  },
  imagePath: 'https://be.southbanknoir.com/upload/img/',
  sailsImagePath: 'https://api.southbanknoir.com/images/',
  port: 8888,
  paymentSnapURL: 'https://app.sandbox.midtrans.com/snap/v1/',
  paymentAPIURL: 'https://api.sandbox.midtrans.com/v2/',
  paymentRedirectURL: 'https://app.sandbox.midtrans.com/snap/v3/redirection/',
  serverKey: 'SB-Mid-server-BaTQ6xxHAHZPOe0LF6-mukEb',
  clientKey: 'SB-Mid-client-HcQTASGdK78b2lLr',
  isProd: false
});
