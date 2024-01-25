module.exports = {
    friendlyName: 'Get list of active coupons',
    fn: async function () {
        var memberPoints = 0;
        let member = await sails.sendNativeQuery(`
            SELECT points
            FROM user_memberships
            WHERE member_id = $1 AND status = $2
        `, [this.req.headers['member-id'], 1]);
        if (member.rows.length > 0) {
            memberPoints = member.rows[0].points;
        }

        let result = {
            points: memberPoints,
            coupons: [],
            my_coupons: []
        };

        let coupons = await sails.sendNativeQuery(`
            SELECT c.id, 
                c.name,
                $3 || c.image as image,
                c.price
            FROM coupons c
            WHERE c.status = $1 AND 
                c.validity_date >= $2
            ORDER BY c.validity_date
        `, [1, new Date(), sails.config.imagePath]);

        if (coupons.rows.length > 0) {
            for (const data of coupons.rows) {
                data.price = await sails.helpers.numberFormat(parseInt(data.price)) + ' Points';
            }
            result.coupons = coupons.rows;
        }

        let myCoupons = await sails.sendNativeQuery(`
            SELECT cm.id,
                c.name,
                $3 || c.image as image,
                to_char(c.start_date, 'DD Mon YYYY') as start_date,
                to_char(c.validity_date, 'DD Mon YYYY') as end_date
            FROM coupons c
            JOIN coupon_members cm ON c.id = cm.coupon_id
            WHERE c.status = $1 AND 
                c.validity_date >= $2 AND 
                cm.member_id = $4 AND 
                cm.usage = $5
            ORDER BY c.validity_date
        `, [1, new Date(), sails.config.imagePath, this.req.headers['member-id'], 0]);

        if (myCoupons.rows.length > 0) {
            result.my_coupons = myCoupons.rows;
        }

        return sails.helpers.convertResult(1, '', result, this.res);
    }
  };