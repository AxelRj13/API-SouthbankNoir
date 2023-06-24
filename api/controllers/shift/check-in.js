module.exports = {

    friendlyName: 'Check in shift karyawan',
    inputs: {
        cashStart: {
          type: 'number',
          required: true
        }
    },
  
    fn: async function ({cashStart}) {
        var userId = this.req.headers.user_id;
        var storeId = this.req.headers.store_id;
        var latestActiveShift = await sails.sendNativeQuery(`
            SELECT id
            FROM shifts
            WHERE user_id = $1 AND 
                store_id = $2 AND
                is_active = 1
            ORDER BY created_at desc
            LIMIT 1
        `, [userId, storeId]);

        if (latestActiveShift.rows.length > 0) {
            return sails.helpers.convertResult(0, 'Harap check out terlebih dahulu.');
        } else {
            await sails.sendNativeQuery(`
                INSERT INTO shifts (user_id, store_id, cash_start, start_at, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 1, $5, $6)
            `, [userId, storeId, cashStart, new Date(), new Date(), new Date()]);

            return sails.helpers.convertResult(1, 'Check in berhasil.');
        }
    }
  };