module.exports = {
    friendlyName: 'Handle callback event from xendit when payment is paid. Event : payment.succeeded',
    inputs: {
        event: {
          type: 'string',
          required: true
        },
        data: {
            type: 'json',
            required: true
        },
    },
    fn: async function ({event, data}) {
        if (event == 'payment.succeeded') {
            let currentDate = new Date();
            let paymentMethodObj = data.payment_method;
            let orderNo = data.reference_id.replace(sails.config.orderTag, '');
            let existingBookings = await sails.sendNativeQuery(`
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
                        LEFT JOIN table_events te ON t.id = te.table_id AND te.status = $3
                        LEFT JOIN events e ON 
                            te.event_id = e.id AND 
                            e.status = $3 AND
                            b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date)
                    )
                    SELECT booking_id, SUM(total_table_capacity) as total_table_capacity, MAX(minimum_spend) as minimum_spend
                    FROM RankedTableEvents
                    WHERE rn = 1
                    GROUP BY booking_id
                )
                SELECT b.id, 
                    b.order_no, 
                    b.member_id,
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
                    e.status = $3 AND
                    (b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date))
                JOIN xendit_payment_responses x ON x.id = b.midtrans_trx_id
                WHERE 
                    b.order_no = $1 AND 
                    lower(so.name) = $2 AND 
                    x.payment_method_id = $4 AND 
                    x.id = $5 AND 
                    lower(x.status) <> $6
                GROUP BY b.id, b.order_no, b.member_id, b.reservation_date, tc.minimum_spend, tc.total_table_capacity, x.id
            `, [orderNo, 'pending payment', 1, paymentMethodObj.id, data.payment_request_id, 'expired']);

            if (existingBookings.rows.length > 0) {
                let memberId = existingBookings.rows[0].member_id;
                // update booking data
                await sails.sendNativeQuery(`
                    UPDATE xendit_payment_responses
                    SET payment_id = $2, 
                        transaction_date = $3, 
                        status = $4, 
                        updated_at = $5
                    WHERE id = $1
                `, [data.payment_request_id, data.id, await sails.helpers.convertDateWithTime(data.created), data.status, currentDate]);

                // update payment response
                let successStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['success']);
                await sails.sendNativeQuery(`
                    UPDATE bookings
                    SET status_order = $2,
                        receipt_ref_no = $3,
                        updated_at = $4
                    WHERE order_no = $1
                `, [existingBookings.rows[0].order_no, successStatusId.rows[0].id, data.id, currentDate]);

                // calculate point for member
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

                return sails.helpers.convertResult(1, 'Payment Request has been successfully paid', null, this.res);
            } else {
                return sails.helpers.convertResult(0, 'Payment Request cannot be found', null, this.res);
            }
        } else {
            return sails.helpers.convertResult(0, 'No event handler found for : ' + event, null, this.res);
        }
    }
  };