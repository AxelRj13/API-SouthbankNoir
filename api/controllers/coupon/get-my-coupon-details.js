module.exports = {
    friendlyName: 'Get details of my coupon',
    inputs: {
        id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({id}) {
        let result = await sails.sendNativeQuery(`
            SELECT cm.id,
                c.description,
                c.name,
                $1 || c.image as image,
                to_char(c.start_date, 'DD Mon YYYY') as start_date, 
                to_char(c.validity_date, 'DD Mon YYYY') as end_date, 
                c.value,
                cm.code
            FROM coupons c
            JOIN coupon_members cm ON c.id = cm.coupon_id
            WHERE c.status = $2 AND 
                cm.id = $3 AND
                cm.member_id = $4 AND 
                cm.status = $2
        `, [sails.config.imagePath, 1, id, this.req.headers['member-id']]);

        if (result.rows.length > 0) {
            if (result.rows[0].value > 0) {
                result.rows[0].value = 'Rp. ' + await sails.helpers.numberFormat(parseInt(result.rows[0].value));
            }
            return sails.helpers.convertResult(1, '', result.rows[0], this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };