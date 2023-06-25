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

  // Stores API
  'GET /api/v1/store/list': { action: 'store/index' },
  'GET /api/v1/store/detail/:id': { action: 'store/detail' },

  // Shifts API
  'POST /api/v1/shift/checkIn': { action: 'shift/check-in' },
  'POST /api/v1/shift/checkOut': { action: 'shift/check-out' },

  // Create Order
  'POST /api/v1/order/create': { action: 'order/create' },

  // List Barang
  'POST /api/v1/product/list': { action: 'product/index'},
  // Check promo
  'POST /api/v1/product/check-promo': { action: 'product/check-promo'},

  // List Satuan
  'POST /api/v1/satuan/list': { action: 'satuan/index'},

  // List Category
  'POST /api/v1/category/list': { action: 'category/index'},

  // List Payment
  'POST /api/v1/payment/list': { action: 'payment/index'}
};
