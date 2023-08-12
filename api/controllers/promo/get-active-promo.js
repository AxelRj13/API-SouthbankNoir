module.exports = {
    friendlyName: 'Get list of active promos',
    inputs: {
        store: {
          type: 'string',
          required: false
        }
    },
    fn: async function ({store}) {
        let result = await sails.sendNativeQuery(`
            SELECT p.id,
                p.title,
                to_char(p.start_date, 'DD Mon') || ' - ' || to_char(p.end_date, 'DD Mon YYYY') as promo_date,
                $2 || p.image as image,
                p.minimum_spend
            FROM promos p
            JOIN promo_stores ps ON p.id = ps.promo_id AND ps.status = $1
            WHERE p.status = $1 AND
                p.end_date >= $3
            ORDER BY p.start_date
        `, [1, sails.config.imagePath, new Date()]);

        if (result.rows.length > 0) {
            for (const data of result.rows) {
                data.minimum_spend = 'Rp. ' + await sails.helpers.numberFormat(parseInt(data.minimum_spend));
            }
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };