module.exports = {

    friendlyName: 'Get detail store',
    description: 'To get detail of 1 record of store based on inputted id.',
    exits: {
        success: {
            description: 'Success get store record.'
        },
        notFound: {
            description: 'No active store records found in the database.',
            responseType: 'notFound'
        }
    },
  
    fn: async function () {
        let storeId = this.req.params.id;
        var result = await sails.sendNativeQuery(`
            SELECT *
            FROM store
            WHERE store_status = $1 AND id = $2
        `, [1,storeId]);

        sails.log(result.rows);
        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };