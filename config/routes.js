/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */

module.exports.routes = {

  //  ╦ ╦╔═╗╔╗ ╦ ╦╔═╗╔═╗╦╔═╔═╗
  //  ║║║║╣ ╠╩╗╠═╣║ ║║ ║╠╩╗╚═╗
  //  ╚╩╝╚═╝╚═╝╩ ╩╚═╝╚═╝╩ ╩╚═╝
  // …


  //  ╔═╗╔═╗╦  ╔═╗╔╗╔╔╦╗╔═╗╔═╗╦╔╗╔╔╦╗╔═╗
  //  ╠═╣╠═╝║  ║╣ ║║║ ║║╠═╝║ ║║║║║ ║ ╚═╗
  //  ╩ ╩╩  ╩  ╚═╝╝╚╝═╩╝╩  ╚═╝╩╝╚╝ ╩ ╚═╝

  // Auth
  'POST /api/v1/auth/login': { action: 'auth/login' },
  'POST /api/v1/auth/register': { action: 'auth/register' },

  // Membership
  'POST /api/v1/membership/details': { action: 'membership/get-membership' },

  // PopupBanner
  'POST /api/v1/popupbanner/get': { action: 'popupbanner/get-active-banner' },

  // Promo
  'POST /api/v1/promo/get-banner': { action: 'promo/get-homepage-banner' },
  'POST /api/v1/promo/get': { action: 'promo/list' },

  // Event
  'POST /api/v1/event/today/get': { action: 'event/get-today-event' },

  // Complaint
  'POST /api/v1/complaint/create': { action: 'complaint/create-complaint' },
  'POST /api/v1/complaint/get': { action: 'complaint/get-complaint-type' },
};
