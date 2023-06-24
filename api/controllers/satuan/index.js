module.exports = {

    friendlyName: 'Get all active satuan',
    exits: {
        success: {
            description: 'Success get all satuan.'
        },
        notFound: {
            description: 'No active satuan records found in the database.',
            responseType: 'notFound'
        }
    },
  
    fn: async function () {
        var result = await sails.sendNativeQuery(`
            SELECT id, isi, satuan
            FROM satuans
            WHERE active = $1
            ORDER BY satuan
        `, [1]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };