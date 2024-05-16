module.exports = {
    friendlyName: 'Get payment data of booking',
    inputs: {
        booking_id: {
          type: 'number',
          required: true
        },
    },
    fn: async function ({booking_id}) {
        var result = [];
        let memberId = this.req.headers['member-id'];
        let pendingPaymentStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['pending payment']);
        let expiredPaymentStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['expired']);
        let bookings = await sails.sendNativeQuery(`
            SELECT b.order_no, b.subtotal, b.discount, b.payment_request_id as payment_request_id, b.payment_method, b.deeplink_redirect, b.promo_code_applied, b.store_id, x.account_number
            FROM bookings b
            JOIN xendit_payment_responses x ON x.id = b.payment_request_id
            WHERE b.id = $1 AND b.status_order = $2 AND b.member_id = $3
        `, [booking_id, pendingPaymentStatusId.rows[0].id, memberId]);

        if (bookings.rows.length > 0) {
            // get payment data from payment gateway
            const fetch = require('node-fetch');
            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    authorization: 'Basic ' + Buffer.from(sails.config.privateKey + ":").toString("base64")
                }
            };
            
            let paymentMethod = await sails.sendNativeQuery(`
                SELECT pm.payment_type, pm.bank_transfer_name
                FROM payment_methods pm
                WHERE pm.status = $1 AND pm.id = $2
            `, [1, bookings.rows[0].payment_method]);

            if (paymentMethod.rows.length <= 0) {
                return sails.helpers.convertResult(0, 'Payment Method Not Found / Inactive', null, this.res);
            }

            var isError = false;
            var isExpired = false;
            var isPaid = false;
            var errorMsg;
            let vaNumber;
            let deeplinkRedirect;
            let paymentStatus;
            await fetch(sails.config.paymentAPIURL + bookings.rows[0].payment_request_id, options)
                .then(res => res.json())
                .then(json => {
                    let paymentMethodObj = json.payment_method;
                    if ((json.status == 'PENDING' || json.status == 'REQUIRES_ACTION') && paymentMethodObj.status == 'ACTIVE') {
                        if (paymentMethod.rows[0].payment_type == 'bank_transfer') {
                            vaNumber = bookings.rows[0].account_number;
                        } else if (paymentMethod.rows[0].payment_type == 'ewallet' || paymentMethod.rows[0].payment_type == 'credit_card') {
                            deeplinkRedirect = bookings.rows[0].deeplink_redirect;
                        }
                    } else if (json.status == 'FAILED' || (json.failure_code == 'PAYMENT_METHOD_EXPIRED' && paymentMethodObj.status == 'EXPIRED')) {
                        isExpired = true;
                        errorMsg = "Transaction already expired, please create another.";
                        paymentStatus = 'EXPIRED';
                    } else if (json.error_code) {
                        isError = true;
                        errorMsg = json.error_code + ' - ' + json.message;
                    } else {
                        isPaid = json.status == 'SUCCEEDED' && paymentMethodObj.status == 'EXPIRED';
                    }
                }).catch(err => {
                    isError = true;
                    errorMsg = err.error_code + ' - ' + err.message;
                });

            // set booking status to failed if payment is expired
            if (isExpired) {
                let currentDate = new Date();
                // update booking to expired
                await sails.sendNativeQuery(`
                    UPDATE bookings
                    SET status_order = $1,
                        updated_at = $3
                    WHERE id = $2
                `, [expiredPaymentStatusId.rows[0].id, booking_id, new Date()]);

                // update payment responses to expired
                await sails.sendNativeQuery(`
                    UPDATE xendit_payment_responses
                    SET status = $2, 
                        updated_at = $3
                    WHERE id = $1
                `, [bookings.rows[0].payment_request_id, paymentStatus, currentDate]);

                // reset promo / coupon usage for this booking if expired
                let promoCode = bookings.rows[0].promo_code_applied;
                if (promoCode) {
                    let storeId = bookings.rows[0].store_id;
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

            if (deeplinkRedirect) {
                result = {
                    redirect_url: deeplinkRedirect
                };
            } else if (isPaid) {
                // if the payment has been paid
                result = {
                    redirect_url: null
                };
            } else {
                result = {
                    order_id: bookings.rows[0].order_no,
                    subtotal: 'Rp. ' + await sails.helpers.numberFormat(bookings.rows[0].discount ? parseInt(bookings.rows[0].subtotal) - parseInt(bookings.rows[0].discount) : parseInt(bookings.rows[0].subtotal)),
                    virtualAccountNumber: (vaNumber) ? vaNumber : '-'
                };

                let paymentInstructions = await sails.sendNativeQuery(`
                    SELECT name, value
                    FROM configurations
                    WHERE name ILIKE 'payment_instruction_%' AND status = $1
                    ORDER BY id
                `, [1]);

                if (paymentInstructions.rows.length > 0) {
                    for (const data of paymentInstructions.rows) {
                        if (data.name.includes('atm')) {
                            result.payment_instruction_atm = data.value.split('\r\n');
                        } else if (data.name.includes('mobile')) {
                            result.payment_instruction_mobile = data.value.split('\r\n');
                        } else if (data.name.includes('internet')) {
                            result.payment_instruction_internet = data.value.split('\r\n');
                        }
                    }
                }
            }

            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Your booking is not on pending payment state.', null, this.res);
        }
    }
  };