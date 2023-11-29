module.exports = {

    friendlyName: 'Create booking',
    inputs: {
        booking_id: {
          type: 'number',
          required: true
        }
    },
  
    fn: async function ({booking_id}) {
        let memberId = this.req.headers['member-id'];
        let member = await sails.sendNativeQuery(`SELECT id FROM members WHERE id = $1 AND status = $2`, [memberId, 1]);
        if (member.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Member Not Found / Inactive', null, this.res);
        }
        // re-validate booking data
        var existingBookings = await sails.sendNativeQuery(`
            SELECT b.id, 
                b.order_no, 
                to_char(b.reservation_date, 'Dy, DD Mon YYYY') as reservation_date,
                t.name as "table_name", 
                t.table_no,
                t.capacity,
                t.minimum_spend,
                b.subtotal, 
                b.discount
            FROM bookings b
            JOIN status_orders so ON b.status_order = so.id
            JOIN booking_details bd ON bd.booking_id = b.id
            JOIN tables t ON bd.table_id = t.id
            WHERE b.id = $1 AND 
                lower(so.name) = $2 AND 
                b.member_id = $3
        `, [booking_id, 'pending payment', memberId]);

        if (existingBookings.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Order not valid or already paid.', null, this.res);
        }

        // call payment gateway API to validate payment
        const fetch = require('node-fetch');
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: 'Basic ' + Buffer.from(sails.config.serverKey).toString("base64")
            }
        };
        var isError = false;
        var isExpired = false;
        var isPaid = false;
        var errorMsg;
        await fetch(sails.config.paymentAPIURL + existingBookings.rows[0].order_no + '/status', options)
            .then(res => res.json())
            .then(json => {
                if (json.status_code == '201' || json.status_code == '200') {
                    isPaid = json.transaction_status == 'settlement' && json.order_id == existingBookings.rows[0].order_no;
                } else if (json.status_code == '407' && json.transaction_status == 'expire') {
                    isExpired = true;
                    errorMsg = "Transaction already expired, please create another.";
                } else {
                    isError = true;
                    errorMsg = json.status_message;
                }
            })
            .catch(err => {
                console.error('error: ' + err);
                errorMsg = err.toString();
                isError = true;
            });
        
        // set booking status to failed if payment is expired
        if (isExpired) {
            let failedPaymentStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['failed']);
            await sails.sendNativeQuery(`
                UPDATE bookings
                SET status_order = $1,
                    updated_at = $3
                WHERE id = $2
            `, [failedPaymentStatusId.rows[0].id, booking_id, new Date()]);
        }

        if (isError || isExpired) {
            return sails.helpers.convertResult(0, errorMsg, null, this.res);
        }

        if (isPaid) {
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

            return sails.helpers.convertResult(1, 'Booking Successfully Paid', {
                receipt_ref_number: null,
                booking_no: existingBookings.rows[0].order_no,
                reservation_date: existingBookings.rows[0].reservation_date,
                table_name: existingBookings.rows[0].table_name + ' - Table ' + existingBookings.rows[0].table_no,
                table_capacity: 'Max ' + existingBookings.rows[0].capacity + ' people',
                minimum_spend: 'Rp. ' + await sails.helpers.numberFormat(parseInt(existingBookings.rows[0].minimum_spend))
            }, this.res);
        } else {
            return sails.helpers.convertResult(0, "Transaction is not paid yet, please proceed with the payment.", null, this.res);
        }
    }
  };