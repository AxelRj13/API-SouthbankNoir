module.exports = {
    friendlyName: 'Get all active stores for dropdown',  
    description: 'To get list of all active stores.',  
    fn: async function () {
        let result = await sails.sendNativeQuery(`
            SELECT id, name
            FROM stores
            WHERE status = $1
        `, [1]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };