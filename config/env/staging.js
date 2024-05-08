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
      url: 'postgresql://southbanknoir:z2PU352zAbxCYw7d@128.199.155.9:5432/staging-southbanknoir'
    }
  },
  imagePath: 'https://be.southbanknoir.com/upload/img/',
  sailsImagePath: 'https://api.southbanknoir.com/images/',
  port: 8888,
  paymentSnapURL: 'https://app.sandbox.midtrans.com/snap/v1/',
  paymentAPIURL: 'https://api.sandbox.midtrans.com/v2/',
  paymentRedirectURL: 'https://app.sandbox.midtrans.com/snap/v3/redirection/',
  creditCardRedirectUrl: 'https://api.sandbox.midtrans.com/v2/3ds/redirect/',
  publicKey: 'xnd_public_development_0dc9V8Wi5Rlo_82S9__Ovnb2NmEzqnhwtdGysbs7BIzWGX5fyY2HmcQmtDuWZ8K',
  privateKey: 'xnd_development_qGi9hx2RoYSjwIAmlFx7bmHso34DSOrQKGs57bM6zlZtJ9gp7ET3Qrx3b2oAza',
  isProd: false,
  orderTag: '-staging',
  paymentExpiry: 5 //minutes
});
