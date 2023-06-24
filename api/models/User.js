/**
 * User.js
 *
 * A user who can log in to this application.
 */

module.exports = {

  tableName: 'users',

  attributes: {

    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    email: {
      type: 'string',
      required: true,
      unique: true,
      isEmail: true,
      maxLength: 100
    },

    username: {
      type: 'string',
      required: true,
      unique: true,
      maxLength: 20
    },

    firstname: {
      type: 'string',
      maxLength: 50
    },
    
    lastname: {
      type: 'string',
      maxLength: 50
    },
    
    store_id: {
      type: 'number'
    },

    password: {
      type: 'string',
      required: true,
      protect: true
    }
  }
};
