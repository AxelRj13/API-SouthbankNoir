module.exports = {
    friendlyName: 'Convert result data to JSON',
    inputs: {
      status: {
        type: 'number',
        required: true
      },
      message: {
        type: 'string',
        required: false
      },
      data: {
        type: 'ref',
        required: false
      },
      res: {
        type: 'ref',
        required: false
      }
    },
    exits: {
      success: {
        description: 'All done.',
      }
    },
  
    fn: async function ({ status, message, data, res }) {
      var response = {};
      response.status = status;
      response.message = message;
      response.data = {};
      response.user = {
        token: res.token,
        id: res.user.data.id,
        email: res.user.data.email,
        name: res.user.data.first_name + ' ' + res.user.data.last_name,
        phone: res.user.data.phone,
        photo: sails.config.sailsImagePath + res.user.data.photo
      }

      if (status) {
        if (!message) {
          message = "OK";
        }
        response.status = status;
        response.message = message;
        if (data) {
          response.data = data;
        } else {
          response.data = [];
        }
      }
      return response;
    }
  };
  
  