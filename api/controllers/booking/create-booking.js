module.exports = {

    friendlyName: 'Create booking',
    inputs: {
        payload: {
          type: 'json',
          required: true
        }
    },
  
    fn: async function ({payload}) {
        let memberId = this.req.headers['member-id'];
        let userLoginName = this.req.headers['user-login-name'];
        let storeId = payload.store_id;
        let bookingDetails = payload.details;
        let promoCode = payload.promo_code;
        let notes = payload.notes;
        let discount = payload.discount;

        // validate reservation date
        var currentDate = new Date();
        var month = currentDate.getMonth() + 1;
        var currentMonth = month < 10 ? '0'+month : month;
        var currentDateFormatDMY = currentDate.getDate().toString() + currentMonth.toString() + currentDate.getFullYear().toString();
        var reservationDate = payload.reservation_date;
        if (!reservationDate) {
            reservationDate = currentDate;
        } else {
            let reservationDateFormatted = await sails.helpers.convertDate(new Date(reservationDate));
            let currentDateFormatted = await sails.helpers.convertDate(currentDate);
            if (reservationDateFormatted < currentDateFormatted) {
                return sails.helpers.convertResult(0, 'Date is not valid, please choose another date.', null, this.res);
            }
        }

        return await sails.getDatastore().transaction(async (db) => {
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

            // booking table validation
            let successBookingStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['success']);
            let pendingPaymentStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['pending payment']);
            for (const data of bookingDetails) {
                var existingBookings = await sails.sendNativeQuery(`
                    SELECT b.id
                    FROM bookings b
                    JOIN booking_details bd ON bd.booking_id = b.id
                    WHERE b.reservation_date = $1 AND 
                        bd.table_id = $2 AND 
                        (
                            b.status_order IN ($3, $4) OR
                            b.member_id = $5
                        )
                `, [reservationDate, data.table_id, successBookingStatusId.rows[0].id, pendingPaymentStatusId.rows[0].id, memberId]).usingConnection(db);

                if (existingBookings.rows.length > 0) {
                    return sails.helpers.convertResult(0, 'Table already booked, please try another table or change the date.', null, this.res);
                }
            }

            // generate no order
            var lastOrderNumber = await sails.sendNativeQuery(`
                SELECT order_no
                FROM bookings
                WHERE created_at::date = $1
                ORDER BY id DESC
                LIMIT 1
            `, [currentDate]).usingConnection(db);

            var orderNumber = 'TRN-SBN-'+currentDateFormatDMY.padStart(8, '0')+'-001';
            if (lastOrderNumber.rows.length > 0) {
                var lastSeq = parseInt(lastOrderNumber.rows[0].order_no.substring(19)) + 1;
                orderNumber = 'TRN-SBN-' + currentDateFormatDMY.padStart(8, '0') + '-' + lastSeq.toString().padStart(3, '0');
            }

            let member = await sails.sendNativeQuery(`SELECT phone FROM members WHERE id = $1 AND status = $2`, [memberId, 1]).usingConnection(db);
            if (member.rows.length <= 0) {
                return sails.helpers.convertResult(0, 'Member Not Found / Inactive', null, this.res);
            }
            var cpPhone = member.rows[0].phone;

            let booking = await sails.sendNativeQuery(`
                INSERT INTO bookings (
                    store_id, member_id, status_order, order_no, reservation_date, 
                    contact_person_name, contact_person_phone, notes, discount,
                    created_by, updated_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $11)
                RETURNING id
            `, [
                storeId, memberId, pendingPaymentStatusId.rows[0].id, orderNumber, reservationDate,
                cpName, cpPhone, (notes ? notes : null), (discount ? discount : null),
                memberId, currentDate
            ]).usingConnection(db);

            let newBookingId = booking.rows[0].id;

            var subtotal = 0;
            for (var i = 0; i < bookingDetails.length; i++) {
                await sails.sendNativeQuery(`
                    INSERT INTO booking_details (booking_id, table_id, total, created_by, updated_by, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $4, $5, $5)
                `, [newBookingId, bookingDetails[i].table_id, bookingDetails[i].total, memberId, currentDate]).usingConnection(db);
                subtotal += bookingDetails[i].total;
            }

            // re-validate promo/voucher in case it has been used on another bookings
            if (promoCode) {
                let promos = await sails.sendNativeQuery(`
                    SELECT p.id, p.value, p.type, p.max_use_per_member, p.minimum_spend
                    FROM promos p
                    JOIN promo_stores ps ON ps.promo_id = p.id
                    WHERE p.code = $1 AND
                        p.status = $2 AND
                        ps.store_id = $3 AND
                        $4 BETWEEN p.start_date AND p.end_date
                `, [promoCode, 1, storeId, currentDate]).usingConnection(db);

                if (promos.rows.length > 0) {
                    let promoUsage = await sails.sendNativeQuery(`
                        SELECT id
                        FROM promo_usage_members
                        WHERE promo_id = $1 AND member_id = $2
                    `, [promos.rows[0].id, memberId]).usingConnection(db);

                    // check maximum usage
                    if (promos.rows[0].max_use_per_member <= promoUsage.rows.length) {
                        return sails.helpers.convertResult(0, 'Promo code has reached maximum usage.', null, this.res);
                    }

                    // check minimum spend
                    if (subtotal < promos.rows[0].minimum_spend) {
                        let diff = promos.rows[0].minimum_spend - subtotal;
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
                    `, [memberId, 1, currentDate, promoCode]).usingConnection(db);

                    if (coupons.rows.length <= 0) {
                        return sails.helpers.convertResult(0, 'Promo / Coupon code not valid or has reached maximum usage.', null, this.res);
                    }
                }
            }

            // update subtotal
            await sails.sendNativeQuery(`
                UPDATE bookings
                SET subtotal = $1, promo_code_applied = $2
                WHERE id = $3
            `, [subtotal, (promoCode ? promoCode : null), newBookingId]).usingConnection(db);

            return sails.helpers.convertResult(1, 'Booking Successfully Created', {id: newBookingId}, this.res);
        })
    }
  };