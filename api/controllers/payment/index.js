module.exports = {

    friendlyName: 'Get all payment method',
    exits: {
        success: {
            description: 'Success get all payment method.'
        },
        notFound: {
            description: 'No active payment method found in the database.',
            responseType: 'notFound'
        }
    },
  
    fn: async function () {
        var result = await sails.sendNativeQuery(`
            SELECT id, name
            FROM payment_method
            WHERE status_transaksi_id = $1
            ORDER BY name
        `, [1]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };