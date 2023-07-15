module.exports = {
    friendlyName: 'Get details of a coupon',
    inputs: {
        id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({id}) {
        let result = await sails.sendNativeQuery(`
            SELECT c.id, 
                c.description,
                c.name,
                $1 || c.image as image,
                to_char(c.validity_date, 'DD Mon YYYY') as validity_date, 
                c.price
            FROM coupons c
            WHERE c.status = $2 AND 
                c.id = $3
        `, [sails.config.imagePath, 1, id]);

        if (result.rows.length > 0) {
            result.rows[0].price = await sails.helpers.numberFormat(parseInt(result.rows[0].price)) + ' Points';
            return sails.helpers.convertResult(1, '', result.rows[0], this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };