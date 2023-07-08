module.exports = {
    friendlyName: 'Get active complaint types for dropdown',
    fn: async function () {
        let complaintTypes = await sails.sendNativeQuery(`
            SELECT id, name
            FROM complaint_types 
            WHERE status = $1
            ORDER BY id
        `, [1]);

        if (complaintTypes.rows.length > 0) {
            return sails.helpers.convertResult(1, '', complaintTypes.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };
  