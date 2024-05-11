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
  'POST /api/v1/auth/check-email': { action: 'auth/check-email' },

  // Splashscreen
  'POST /api/v1/splashscreen/get': { action: 'splashscreen/get-active-splashscreen' },

  // Membership
  'POST /api/v1/membership/details': { action: 'membership/get-membership' },

  // PopupBanner
  'POST /api/v1/popupbanner/get': { action: 'popupbanner/get-active-banner' },

  // Promo
  'POST /api/v1/promo/get-banner': { action: 'promo/get-homepage-banner' },
  'POST /api/v1/promo/get': { action: 'promo/get-active-promo' },
  'POST /api/v1/promo/details': { action: 'promo/get-promo-details' },

  // News / Announcement
  'POST /api/v1/news/get': { action: 'news/get-active-news' },
  'POST /api/v1/news/details': { action: 'news/get-news-details' },

  // Event
  'POST /api/v1/event/today/get': { action: 'event/get-today-event' },
  'POST /api/v1/event/get': { action: 'event/get-active-event' },
  'POST /api/v1/event/details': { action: 'event/get-details-event' },

  // Complaint
  'POST /api/v1/complaint/create': { action: 'complaint/create-complaint' },
  'POST /api/v1/complaint/get': { action: 'complaint/get-complaint-type' },

  // Store
  'POST /api/v1/store/get': { action: 'store/get-active-stores' },
  'POST /api/v1/store/details': { action: 'store/get-store-details' },

  // Contact Us
  'POST /api/v1/contactus/get': { action: 'contactus/get-active-contact' },

  // Profile
  'POST /api/v1/profile/update': { action: 'profile/update-profile' },
  'POST /api/v1/profile/point-history': { action: 'profile/point-history' },

  // Coupon
  'POST /api/v1/coupon/get': { action: 'coupon/get-active-coupons' },
  'POST /api/v1/coupon/details': { action: 'coupon/get-coupon-details' },
  'POST /api/v1/my-coupon/details': { action: 'coupon/get-my-coupon-details' },
  'POST /api/v1/coupon/buy-coupon': { action: 'coupon/buy-coupon' },

  // Table
  'POST /api/v1/table/get': { action: 'table/get-table-layout' },

  // Booking
  'POST /api/v1/booking/create': { action: 'booking/create-booking' },
  'POST /api/v1/booking/list': { action: 'booking/booking-list' },
  'POST /api/v1/booking/details': { action: 'booking/booking-details' },
  'POST /api/v1/booking/apply-promo': { action: 'booking/apply-promo' },
  'POST /api/v1/booking/payment': { action: 'booking/payment' },
  'POST /api/v1/booking/confirm/payment': { action: 'booking/confirm-payment' },

  // Payment Method
  'POST /api/v1/payment-method/get': { action: 'paymentmethod/get-payment-method' },

  // XENDIT
  'POST /api/v1/xendit/callback/paid-event-handler': { action: 'xendit/paid-event-handler' },
};
