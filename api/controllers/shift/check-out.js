module.exports = {

    friendlyName: 'Check out shift karyawan',
    inputs: {
        cashEnd: {
          type: 'number',
          required: true
        }
    },
  
    fn: async function ({cashEnd}) {
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

        if (latestActiveShift.rows.length < 1) {
            return sails.helpers.convertResult(0, 'Tidak ada shift aktif, harap check in terlebih dahulu.');
        } else {
            await sails.sendNativeQuery(`
                UPDATE shifts
                SET is_active = 0,
                    cash_end = $1,
                    end_at = $2,
                    updated_at = $2
                WHERE id = $3
            `, [cashEnd, new Date(), latestActiveShift.rows[0].id]);

            return sails.helpers.convertResult(1, 'Check out berhasil.');
        }
    }
  };