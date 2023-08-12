module.exports = {
    friendlyName: 'Get details of a promo',
    inputs: {
        id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({id}) {
        let result = await sails.sendNativeQuery(`
            SELECT p.title,
                p.description,
                to_char(p.start_date, 'DD Mon') || ' - ' || to_char(p.end_date, 'DD Mon YYYY') as promo_date,
                $2 || p.image as image,
                p.minimum_spend
            FROM promos p
            JOIN promo_stores ps ON p.id = ps.promo_id AND ps.status = $1
            WHERE p.status = $1 AND p.id = $3
        `, [1, sails.config.imagePath, id]);

        if (result.rows.length > 0) {
            result.rows[0].minimum_spend = 'Rp. ' + await sails.helpers.numberFormat(parseInt(result.rows[0].minimum_spend));
            return sails.helpers.convertResult(1, '', result.rows[0], this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };