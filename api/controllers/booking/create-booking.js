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
                var lastSeq = parseInt(lastOrderNumber.rows[0].order_no.substring(17)) + 1;
                orderNumber = 'TRN-SBN-' + currentDateFormatDMY.padStart(8, '0') + '-' + lastSeq.toString().padStart(3, '0');
            }

            let member = await sails.sendNativeQuery(`SELECT first_name, last_name, phone, email FROM members WHERE id = $1 AND status = $2`, [memberId, 1]).usingConnection(db);
            if (member.rows.length <= 0) {
                return sails.helpers.convertResult(0, 'Member Not Found / Inactive', null, this.res);
            }

            // calculate subtotal
            var subtotal = 0;
            var paymentDetailsPayload = [];
            for (var i = 0; i < bookingDetails.length; i++) {
                subtotal += bookingDetails[i].total;

                let table = await sails.sendNativeQuery(`
                    SELECT t.name, t.table_no
                    FROM tables t
                    WHERE t.id = $1
                `, [bookingDetails[i].table_id]);

                paymentDetailsPayload.push({
                    id: bookingDetails[i].table_id,
                    name: 'Table ' + table.rows[0].table_no + ' ' + table.rows[0].name,
                    price: bookingDetails[i].total,
                    quantity: 1,
                    brand: 'SouthbankNoir',
                    category: 'Reservation',
                    merchant_name: 'SouthbankNoir'
                });
            }

            // re-validate promo/voucher in case it has been used on another bookings (prevent racing condition)
            var discount = 0;
            let appliedPromoId;
            let appliedCouponId;
            if (promoCode) {
                let promoValue = 0;
                let promoType;
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

                    promoValue = promos.rows[0].value;
                    promoType = promos.rows[0].type;
                    appliedPromoId = promos.rows[0].id;
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
                            cm.code = $4 AND
                            cm.usage = $5
                    `, [memberId, 1, currentDate, promoCode, 0]).usingConnection(db);

                    if (coupons.rows.length <= 0) {
                        return sails.helpers.convertResult(0, 'Promo / Coupon code not valid or has reached maximum usage.', null, this.res);
                    } else {
                        promoValue = coupons.rows[0].value;
                        promoType = coupons.rows[0].type;
                        appliedCouponId = coupons.rows[0].id;
                    }
                }

                // convert if type is percentage
                discount = promoValue;
                if (promoType == 'percentage') {
                    discount = parseInt((promoValue/100) * subtotal);
                }
                // add discount item for payment payload
                paymentDetailsPayload.push({
                    name: 'discount',
                    price: discount * -1,
                    quantity: 1,
                    brand: 'SouthbankNoir',
                    category: 'Reservation',
                    merchant_name: 'SouthbankNoir'
                });
            }

            // connect to payment gateway
            const midtransClient = require('midtrans-client');
            let core = new midtransClient.CoreApi({
                isProduction : sails.config.isProd,
                serverKey : sails.config.serverKey,
                clientKey : sails.config.clientKey
            });

            let parameter = JSON.stringify({
                payment_type: "bank_transfer",
                transaction_details: {
                    order_id: orderNumber,
                    gross_amount: subtotal - discount
                },
                item_details: paymentDetailsPayload,
                customer_details: {
                    first_name: member.rows[0].first_name,
                    last_name: member.rows[0].last_name,
                    email: member.rows[0].email,
                    phone: member.rows[0].phone
                },
                bank_transfer: {
                    bank: "bca"
                },
                custom_expiry: {
                    expiry_duration: 60,
                    unit: "minute"
                }
            });

            let paymentResult;
            var isError = false;
            var errorMsg;
            await core.charge(parameter)
                .then((chargeResponse) => {
                    if (chargeResponse.status_code !== '201') {
                        errorMsg = 'Payment Transaction Error due to: ' + chargeResponse.status_message;
                        isError = true;
                    } else {
                        paymentResult = chargeResponse;
                    }
                })
                .catch((err) => {
                    errorMsg = err.message;
                    if (err.ApiResponse) {
                        errorMsg = err.ApiResponse.status_message;
                    }
                    console.error('Error: ' + errorMsg);
                    isError = true;
                });
            ;
            
            if (isError) {
                return sails.helpers.convertResult(0, errorMsg, null, this.res);
            }

            // create booking data
            let booking = await sails.sendNativeQuery(`
                INSERT INTO bookings (
                    store_id, member_id, status_order, order_no, reservation_date, 
                    contact_person_name, contact_person_phone, notes, discount, promo_code_applied,
                    created_by, updated_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $12)
                RETURNING id
            `, [
                storeId, memberId, pendingPaymentStatusId.rows[0].id, orderNumber, reservationDate,
                cpName, cpPhone, (notes ? notes : null), (discount > 0 ? discount : null), (promoCode && discount > 0 ? promoCode : null),
                memberId, currentDate
            ]).usingConnection(db);

            let newBookingId = booking.rows[0].id;
            for (var i = 0; i < bookingDetails.length; i++) {
                await sails.sendNativeQuery(`
                    INSERT INTO booking_details (booking_id, table_id, total, created_by, updated_by, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $4, $5, $5)
                `, [newBookingId, bookingDetails[i].table_id, bookingDetails[i].total, memberId, currentDate]).usingConnection(db);
            }

            // update subtotal and payment trx id
            await sails.sendNativeQuery(`
                UPDATE bookings
                SET subtotal = $1,
                    midtrans_trx_id = $2
                WHERE id = $3
            `, [subtotal, paymentResult.transaction_id, newBookingId]).usingConnection(db);

            // save promo / coupon usage
            if (appliedPromoId) {
                // save promo usage
                await sails.sendNativeQuery(`
                    INSERT INTO promo_usage_members (promo_id, member_id, booking_id, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $4)
                `, [appliedPromoId, memberId, newBookingId, currentDate]).usingConnection(db);
            } else {
                if (appliedCouponId) {
                    // save coupon usage
                    await sails.sendNativeQuery(`
                        UPDATE coupon_members
                        SET usage = usage + $1
                        WHERE id = $2
                    `, [1, appliedCouponId]).usingConnection(db);
                }
            }

            return sails.helpers.convertResult(1, 'Booking Successfully Created', {id: newBookingId}, this.res);
        })
    }
  };