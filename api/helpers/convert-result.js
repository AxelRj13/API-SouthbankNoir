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
      if (status) {
        if (!message) {
          message = undefined;
        }
  
        var user = undefined;
        if (res) {
          user = {
            token: res.token,
            id: res.user.data.id,
            email: res.user.data.email,
            name: res.user.data.first_name + ' ' + res.user.data.last_name,
            photo: sails.config.imagePath + res.user.data.photo
          }
        }
        
        return {
          status: status,
          message: message,
          count: data ? data.length : undefined,
          data: data,
          user: user
        };
      } else {
        return {
          status: status,
          message: message
        };
      }
    }
  };
  
  