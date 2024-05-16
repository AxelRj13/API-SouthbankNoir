module.exports = {
    friendlyName: 'Create booking',
    inputs: {
        booking_id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({booking_id}) {
        let currentDate = new Date();
        let memberId = this.req.headers['member-id'];
        let member = await sails.sendNativeQuery(`SELECT id FROM members WHERE id = $1 AND status = $2`, [memberId, 1]);
        if (member.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Member Not Found / Inactive', null, this.res);
        }
        // re-validate booking data
        var existingBookings = await sails.sendNativeQuery(`
            WITH TableCapacityCTE AS (
                WITH RankedTableEvents AS (
                    SELECT 
                        bd.booking_id,
                        COALESCE(te.capacity, t.capacity) AS total_table_capacity,
                        COALESCE(te.minimum_spend, t.minimum_spend) AS minimum_spend,
                        ROW_NUMBER() OVER (PARTITION BY bd.booking_id, t.id ORDER BY COALESCE(te.capacity, t.capacity) DESC) AS rn
                    FROM booking_details bd
                    JOIN bookings b ON bd.booking_id = b.id
                    JOIN tables t ON bd.table_id = t.id
                    LEFT JOIN table_events te ON t.id = te.table_id AND te.status = $4
                    LEFT JOIN events e ON 
                        te.event_id = e.id AND 
                        e.status = $4 AND
                        b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date)
                )
                SELECT booking_id, SUM(total_table_capacity) as total_table_capacity, MAX(minimum_spend) as minimum_spend
                FROM RankedTableEvents
                WHERE rn = 1
                GROUP BY booking_id
            )
            SELECT b.id, 
                b.order_no, 
                to_char(b.reservation_date, 'Dy, DD Mon YYYY') as reservation_date,
                string_agg(DISTINCT t.name || ' ' || t.table_no, ' | ') as table_name,
                tc.total_table_capacity as capacity,
                tc.minimum_spend,
                b.subtotal, 
                b.discount,
                b.promo_code_applied,
                b.store_id,
                x.id as payment_request_id,
                x.status as xendit_status,
                x.payment_id
            FROM bookings b
            JOIN TableCapacityCTE tc ON b.id = tc.booking_id
            JOIN status_orders so ON b.status_order = so.id
            JOIN booking_details bd ON bd.booking_id = b.id
            JOIN tables t ON bd.table_id = t.id
            JOIN stores s ON b.store_id = s.id
            LEFT JOIN events e ON 
                e.store_id = s.id AND
                e.status = $4 AND
                (b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date))
            JOIN xendit_payment_responses x ON x.id = b.payment_request_id
            WHERE b.id = $1 AND 
                lower(so.name) = $2 AND 
                b.member_id = $3
            GROUP BY b.id, b.order_no, b.reservation_date, tc.minimum_spend, tc.total_table_capacity, x.id
        `, [booking_id, 'pending payment', memberId, 1]);

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
                authorization: 'Basic ' + Buffer.from(sails.config.privateKey + ":").toString("base64")
            }
        };
        var isError = false;
        var isExpired = false;
        var isPaid = false;
        var errorMsg;
        let receiptRefNo;
        let paymentStatus;
        let transactionDate = currentDate;
        await fetch(sails.config.paymentAPIURL + existingBookings.rows[0].payment_request_id, options)
            .then(res => res.json())
            .then(json => {
                let paymentMethodObj = json.payment_method;
                if ((json.status == 'SUCCEEDED' && paymentMethodObj.status == 'EXPIRED') || existingBookings.rows[0].xendit_status == 'SUCCEEDED') {
                    isPaid = true;
                    receiptRefNo = existingBookings.rows[0].payment_id;
                    paymentStatus = json.status;
                    transactionDate = paymentMethodObj.updated;
                } else if (json.status == 'FAILED' || (json.failure_code == 'PAYMENT_METHOD_EXPIRED' && paymentMethodObj.status == 'EXPIRED')) {
                    isExpired = true;
                    errorMsg = "Transaction already expired, please create another.";
                    paymentStatus = 'EXPIRED';
                } else if (json.error_code) {
                    isError = true;
                    errorMsg = json.error_code + ' - ' + json.message;
                }
            }).catch(err => {
                isError = true;
                errorMsg = err.error_code + ' - ' + err.message;
            });
        
        // set booking status to failed if payment is expired
        if (isExpired) {
            let expiredPaymentStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['expired']);
            await sails.sendNativeQuery(`
                UPDATE bookings
                SET status_order = $1,
                    updated_at = $3
                WHERE id = $2
            `, [expiredPaymentStatusId.rows[0].id, booking_id, currentDate]);

            // update payment responses to expired
            await sails.sendNativeQuery(`
                UPDATE xendit_payment_responses
                SET status = $2, 
                    updated_at = $3
                WHERE id = $1
            `, [existingBookings.rows[0].payment_request_id, paymentStatus, currentDate]);

            // reset promo / coupon usage for this booking if expired
            let promoCode = existingBookings.rows[0].promo_code_applied;
            if (promoCode) {
                let storeId = existingBookings.rows[0].store_id;
                let promos = await sails.sendNativeQuery(`
                    SELECT p.id, p.value, p.type, p.max_use_per_member, p.minimum_spend
                    FROM promos p
                    JOIN promo_stores ps ON ps.promo_id = p.id
                    WHERE UPPER(p.code) = $1 AND
                        p.status = $2 AND
                        ps.store_id = $3 AND
                        $4 BETWEEN p.start_date AND p.end_date
                `, [promoCode.toUpperCase(), 1, storeId, currentDate]);

                if (promos.rows.length > 0) {
                    // hard delete promo usage members
                    await sails.sendNativeQuery(`
                        DELETE FROM promo_usage_members 
                        WHERE promo_id = $1 AND 
                            member_id = $2 AND 
                            booking_id = $3
                    `, [promos.rows[0].id, memberId, booking_id]);
                } else {
                    let coupons = await sails.sendNativeQuery(`
                        SELECT cm.id, c.value, c.type
                        FROM coupon_members cm
                        JOIN coupons c ON cm.coupon_id = c.id
                        WHERE cm.member_id = $1 AND
                            cm.status = $2 AND
                            c.status = $2 AND
                            c.start_date <= $3 AND
                            c.validity_date >= $3 AND
                            UPPER(cm.code) = $4 AND
                            cm.usage > $5
                    `, [memberId, 1, currentDate, promoCode.toUpperCase(), 0]);

                    if (coupons.rows.length > 0) {
                        await sails.sendNativeQuery(`
                            UPDATE coupon_members
                            SET usage = usage - $1
                            WHERE id = $2
                        `, [1, coupons.rows[0].id]);
                    }
                }
            }
        }

        if (isError || isExpired) {
            return sails.helpers.convertResult(0, errorMsg, null, this.res);
        }

        // if the transaction has been successfully PAID
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
                // check user memberships data
                let userMemberships = await sails.sendNativeQuery(`
                    SELECT um.total_spent, um.points
                    FROM user_memberships um
                    WHERE um.member_id = $1
                `, [memberId]);

                var totalSpent = 0;
                var currPoint = 0;
                if (userMemberships.rows.length <= 0) {
                    // if memberships not exist, create new one
                    await sails.sendNativeQuery(`
                        INSERT INTO user_memberships (
                            member_id, membership_tier_id, points, total_spent, status,
                            created_by, updated_by, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7)
                        RETURNING id
                    `, [memberId, 1, 0, 0, 1, memberId, currentDate]);
                } else {
                    totalSpent = userMemberships.rows[0].total_spent;
                    currPoint = userMemberships.rows[0].points + calcPoint;
                }

                // check membership tier eligible update
                let membershipTier = await sails.sendNativeQuery(`
                    SELECT mt.id
                    FROM membership_tiers mt
                    WHERE mt.status = $1 AND mt.total_spent_min < $2
                    ORDER BY mt.id DESC
                    LIMIT 1
                `, [1, totalSpent + subtotal]);

                if (membershipTier.rows.length > 0) {
                    // update membership to the next tier
                    await sails.sendNativeQuery(`
                        UPDATE user_memberships
                        SET membership_tier_id = $1
                        WHERE member_id = $2
                    `, [membershipTier.rows[0].id, memberId]);
                }

                await sails.sendNativeQuery(`
                    UPDATE user_memberships 
                    SET points = points + $1,
                        total_spent = total_spent + $2,
                        updated_at = $3
                    WHERE member_id = $4
                `, [calcPoint, subtotal, currentDate, memberId]);

                // record point history
                await sails.sendNativeQuery(`
                    INSERT INTO point_history_logs (member_id, title, type, amount, latest_point, nominal, created_by, updated_by, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $8)
                `, [
                    memberId, 
                    'Adjustment on Mobile Apps<br><b>Rp. ' + await sails.helpers.numberFormat(subtotal) + '</b>',
                    'increment',
                    calcPoint,
                    currPoint,
                    subtotal,
                    memberId,
                    currentDate
                ]);
            }

            // update booking status to success
            let statusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['success']);
            await sails.sendNativeQuery(`
                UPDATE bookings 
                SET status_order = $1,
                    receipt_ref_no = $2,
                    updated_at = $3
                WHERE id = $4
            `, [statusId.rows[0].id, (receiptRefNo) ? receiptRefNo : null, currentDate, booking_id]);

            // update payment responses if not updated yet
            await sails.sendNativeQuery(`
                UPDATE xendit_payment_responses
                SET transaction_date = $4, 
                    status = $5, 
                    updated_at = $6
                WHERE id = $1 AND 
                    status IN ($2, $3) AND 
                    payment_id IS NULL
            `, [existingBookings.rows[0].payment_request_id, 'ACTIVE', 'PENDING', await sails.helpers.convertDateWithTime(transactionDate), paymentStatus, currentDate]);

            return sails.helpers.convertResult(1, 'Booking Successfully Paid', {
                receipt_ref_number: (receiptRefNo) ? receiptRefNo : null,
                booking_no: existingBookings.rows[0].order_no,
                reservation_date: existingBookings.rows[0].reservation_date,
                table_name: existingBookings.rows[0].table_name,
                table_capacity: 'Max ' + existingBookings.rows[0].capacity + ' people',
                minimum_spend: 'Rp. ' + await sails.helpers.numberFormat(parseInt(existingBookings.rows[0].minimum_spend))
            }, this.res);
        } else {
            return sails.helpers.convertResult(0, "Transaction is not paid yet, please proceed with the payment.", null, this.res);
        }
    }
  };