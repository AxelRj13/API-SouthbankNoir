module.exports = {
    friendlyName: 'Create complaint',
    inputs: {
        type: {
            type: 'number',
            required: true
        },
        date: {
            type: 'string',
            required: false
        },
        store: {
            type: 'number',
            required: true
        },
        description: {
            type: 'string',
            required: true
        }
    },
  
    fn: async function ({type, date, store, description}) {
        var memberId = this.req.headers['member-id'];
        var memberName = this.req.headers['user-login-name'];
        let stores = await sails.sendNativeQuery(`SELECT name FROM stores WHERE id = $1 AND status = $2`, [store, 1]);
        if (stores.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Store not found / not active anymore.');
        }
        let complaintType = await sails.sendNativeQuery(`SELECT name FROM complaint_types WHERE id = $1 AND status = $2`, [type, 1]);
        if (complaintType.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Complaint type not found / not active anymore.');
        }
        if (!date) {
            date = new Date();
        }
        await sails.sendNativeQuery(`
            INSERT INTO complaints (member_id, store_name, name, type, date, description, status, created_by, updated_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7, $8, $8)
        `, [memberId, stores.rows[0].name, memberName, complaintType.rows[0].name, date, description, memberId, new Date()]);

        return sails.helpers.convertResult(1, 'Complaint successfully created.', null, this.res);
    }
  };