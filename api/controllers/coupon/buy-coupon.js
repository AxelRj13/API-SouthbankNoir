module.exports = {
    friendlyName: 'Buy a coupon',
    inputs: {
        coupon_id: {
            type: 'number',
            required: true
        }
    },
  
    fn: async function ({coupon_id}) {
        var memberId = this.req.headers['member-id'];
        let currDate = new Date();
        // validate coupon
        let coupon = await sails.sendNativeQuery(`
            SELECT c.id, c.price
            FROM coupons c
            WHERE c.status = $1 AND 
                c.validity_date >= $2 AND
                c.id = $3
        `, [1, currDate, coupon_id]);
        if (coupon.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Coupon has expired / not exist anymore, please browse another voucher.', null, this.res);
        } else {
            // check if member's point sufficient
            let userPoint = await sails.sendNativeQuery(`
                SELECT points
                FROM user_memberships
                WHERE member_id = $1 AND status = $2
            `, [memberId, 1]);

            var point = 0
            if (userPoint.rows.length > 0) {
                point = userPoint.rows[0].points;
            }

            if (point < coupon.rows[0].price) {
                return sails.helpers.convertResult(0, 'Purchase failed, your point is insufficient.', null, this.res);
            }
        }

        // generate code
        let couponNewCode = await generateCouponCode();
        await sails.sendNativeQuery(`
            INSERT INTO coupon_members (coupon_id, member_id, code, status, created_by, updated_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $5, $6, $6)
        `, [coupon_id, memberId, couponNewCode, 1, memberId, currDate]);

        // check if coupon purchase success
        let couponMember = await sails.sendNativeQuery(`
            SELECT id
            FROM coupon_members
            WHERE member_id = $1 AND 
                status = $2 AND
                code = $3
        `, [memberId, 1, couponNewCode]);

        if (couponMember.rows.length > 0) {
            // reduce member's point
            await sails.sendNativeQuery(`
                UPDATE user_memberships
                SET points = points - $1
                WHERE member_id = $2 AND status = $3
            `, [coupon.rows[0].price, memberId, 1]);

            // record point history
            await sails.sendNativeQuery(`
                INSERT INTO point_history_logs (member_id, title, type, amount, latest_point, created_by, updated_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7)
            `, [
                memberId, 
                'Buy Coupon',
                'decrement',
                coupon.rows[0].price,
                point - coupon.rows[0].price,
                memberId,
                new Date()
            ]);

            return sails.helpers.convertResult(1, 'Coupon successfully purchased.', null, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Coupon purchase failed, please try again.', null, this.res);
        }
    }
};

async function generateCouponCode() {
    var code = Math.random().toString(36).slice(2).substring(0, 6).toUpperCase();
    let checkExistingCode = await sails.sendNativeQuery(`
        SELECT id
        FROM coupon_members
        WHERE status = $1 AND code = $2
    `, [1, code]);

    while(checkExistingCode.rows.length > 0) {
        code = generateCouponCode();
    }

    return code;
}