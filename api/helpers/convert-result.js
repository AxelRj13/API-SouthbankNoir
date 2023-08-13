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
      response.data = [];
      response.token = null;
      if (res) {
        response.token = res.token;
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
  
  