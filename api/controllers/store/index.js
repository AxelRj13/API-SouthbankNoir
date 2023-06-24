module.exports = {

    friendlyName: 'Get all stores',  
    description: 'To get list of all active stores.',
    // inputs: {},
    exits: {
        success: {
            description: 'Success get all stores.'
        },
        notFound: {
            description: 'No active store records found in the database.',
            responseType: 'notFound'
        }
    },
  
    fn: async function () {
        var result = await sails.sendNativeQuery(`
            SELECT *
            FROM store
            WHERE store_status = $1
        `, [1]);
        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };