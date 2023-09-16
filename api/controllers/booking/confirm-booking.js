module.exports = {
    friendlyName: 'Confirm booking',
    inputs: {
        payload: {
          type: 'json',
          required: true
        }
    },
    fn: async function ({payload}) {
        let memberId = this.req.headers['member-id'];
        let userLoginName = this.req.headers['user-login-name'];
        let bookingId = payload.booking_id;

        // check contact person info from input, if empty then get from headers
        var cpName = payload.contact_person_name;
        var cpPhone = payload.contact_person_phone;
        if (cpName == null || cpName == '') {
            cpName = userLoginName;
        }
        if (cpPhone == null || cpPhone == '') {
            let member = await sails.sendNativeQuery(`
                SELECT phone
                FROM members
                WHERE id = $1 AND status = $2
            `, [memberId, 1]);
            
            if (member.rows.length <= 0) {
                return sails.helpers.convertResult(0, 'Member Not Found / Inactive');
            }

            cpPhone = member.rows[0].phone;
        }

        // re-check table availability on reservation date
        let sucessBookingStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['success']);
        var isCancelBooking = false;
        let failedMsg;
        let booking = await sails.sendNativeQuery(`
            SELECT b.id, b.promo_code_applied, b.store_id, bd.table_id, b.reservation_date, b.subtotal
            FROM bookings b
            JOIN booking_details bd ON bd.booking_id = b.id
            WHERE b.id = $1 AND b.status_order = (SELECT id FROM status_orders WHERE lower(name) = 'new')
        `, [bookingId]);

        if (booking.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Cannot process your booking.', null, this.res);
        }

        for (const bookingData of booking.rows) {
            var tables = await sails.sendNativeQuery(`
                SELECT t.id
                FROM tables t
                JOIN booking_details bd ON t.id = bd.table_id
                JOIN bookings b ON bd.booking_id = b.id
                WHERE t.status = $1 AND 
                    t.id = $2 AND 
                    b.id <> $3 AND 
                    b.reservation_date = $4 AND 
                    b.status_order = $5
                ORDER BY t.table_no ASC
            `, [1, bookingData.table_id, bookingId, bookingData.reservation_date, sucessBookingStatusId.rows[0].id]);

            if (tables.rows.length > 0) {
                isCancelBooking = true;
                failedMsg = 'Booking Failed, tables already booked / not available. Please choose other tables.';
            }
        }

        if (!isCancelBooking) {
            // re-validate promo/voucher in case it has been used on another bookings
            let promos = await sails.sendNativeQuery(`
                SELECT p.id, p.value, p.type, p.max_use_per_member, p.minimum_spend
                FROM promos p
                JOIN promo_stores ps ON ps.promo_id = p.id
                WHERE p.code = $1 AND
                    p.status = $2 AND
                    ps.store_id = $3 AND
                    $4 BETWEEN p.start_date AND p.end_date
            `, [booking.rows[0].promo_code_applied, 1, booking.rows[0].store_id, new Date()]);
        
            if (promos.rows.length > 0) {
                let promoUsage = await sails.sendNativeQuery(`
                    SELECT id
                    FROM promo_usage_members
                    WHERE promo_id = $1 AND member_id = $2
                `, [promos.rows[0].id, memberId]);
    
                // check maximum usage
                if (promos.rows[0].max_use_per_member <= promoUsage.rows.length) {
                    return sails.helpers.convertResult(0, 'Promo code has reached maximum usage.', null, this.res);
                }
    
                // check minimum spend
                if (booking.rows[0].subtotal < promos.rows[0].minimum_spend) {
                    let diff = promos.rows[0].minimum_spend - booking.rows[0].subtotal;
                    return sails.helpers.convertResult(0, 'You need to spend Rp. ' + await sails.helpers.numberFormat(parseInt(diff)) + ' more to apply this promo.', null, this.res);
                }
            } else {
                let coupons = await sails.sendNativeQuery(`
                    SELECT c.value, c.type
                    FROM coupon_members cm
                    JOIN coupons c ON cm.coupon_id = c.id
                    WHERE cm.member_id = $1 AND
                        cm.status = $2 AND
                        c.status = $2 AND
                        c.start_date <= $3 AND
                        c.validity_date >= $3 AND
                        cm.code = $4
                `, [memberId, 1, new Date(), booking.rows[0].promo_code_applied]);
    
                if (coupons.rows.length <= 0) {
                    return sails.helpers.convertResult(0, 'Promo / Coupon code not valid or has reached maximum usage.', null, this.res);
                }
            }    
        }
        
        // table already booked, cancel this booking and redirect to reservation page
        if (isCancelBooking) {
            await sails.sendNativeQuery(`
                UPDATE bookings
                SET status_order = (SELECT id FROM status_orders WHERE lower(name) = 'failed')
                WHERE id = $1
            `, [bookingId]);
            return sails.helpers.convertResult(0, failedMsg, null, this.res);
        }

        // if ALL valid, finalize update booking data
        await sails.sendNativeQuery(`
            UPDATE bookings
            SET contact_person_name = $1,
                contact_person_phone = $2,
                notes = $3,
                status_order = (SELECT id FROM status_orders WHERE lower(name) = 'pending payment')
            WHERE id = $4
        `, [cpName, cpPhone, payload.notes, bookingId]);

        return sails.helpers.convertResult(1, 'Booking Successfully Confirmed', null, this.res);
    }
  };