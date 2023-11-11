module.exports = {

    friendlyName: 'Create booking',
    inputs: {
        booking_id: {
          type: 'number',
          required: true
        }
    },
  
    fn: async function ({booking_id}) {
        // TO DO: call payment gateway API to validate payment
        // ------

        let memberId = this.req.headers['member-id'];
        // re-validate booking data
        var existingBookings = await sails.sendNativeQuery(`
            SELECT b.id, b.subtotal, b.discount
            FROM bookings b
            JOIN status_orders so ON b.status_order = so.id
            WHERE b.id = $1 AND 
                lower(so.name) = $2
        `, [booking_id, 'pending payment']);

        if (existingBookings.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Order not valid or already paid.', null, this.res);
        }

        let member = await sails.sendNativeQuery(`SELECT phone FROM members WHERE id = $1 AND status = $2`, [memberId, 1]);
        if (member.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Member Not Found / Inactive', null, this.res);
        }

        // point setting
        var memberConfigPoint = await sails.sendNativeQuery(`
            SELECT value
            FROM configurations
            WHERE lower(name) = $1 
        `, ['member_config_point']);

        if (memberConfigPoint.rows.length > 0) {
            var subtotal = parseInt(existingBookings.rows[0].discount ? (existingBookings.rows[0].subtotal - existingBookings.rows[0].discount) : existingBookings.rows[0].subtotal);
            var calcPoint = Math.floor(subtotal / memberConfigPoint.rows[0].value);
            await sails.sendNativeQuery(`
                UPDATE user_memberships 
                SET points = points + $1,
                    total_spent = total_spent + $2,
                    updated_at = $3
                WHERE member_id = $4
            `, [calcPoint, subtotal, new Date(), memberId]);

            // check membership tier eligible update
            let userMemberships = await sails.sendNativeQuery(`
                SELECT um.total_spent
                FROM user_memberships um
                WHERE um.member_id = $1
            `, [memberId]);

            if (userMemberships.rows.length > 0) {
                let membershipTier = await sails.sendNativeQuery(`
                    SELECT mt.id
                    FROM membership_tiers mt
                    WHERE mt.status = $1 AND mt.total_spent_min < $2
                    ORDER BY mt.id DESC
                    LIMIT 1
                `, [1, userMemberships.rows[0].total_spent]);

                if (membershipTier.rows.length > 0) {
                    // update membership to the next tier
                    await sails.sendNativeQuery(`
                        UPDATE user_memberships
                        SET membership_tier_id = $1
                        WHERE member_id = $2
                    `, [membershipTier.rows[0].id, memberId]);
                }
            }
        }

        // update booking status to success
        let statusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['success']);
        await sails.sendNativeQuery(`
            UPDATE bookings 
            SET status_order = $1,
                updated_at = $2
            WHERE id = $3
        `, [statusId.rows[0].id, new Date(), booking_id]);

        return sails.helpers.convertResult(1, 'Booking Successfully Paid', {id: booking_id}, this.res);
    }
  };