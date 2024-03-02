module.exports = {
    friendlyName: 'Get list of tables and layout',
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
            SELECT b.order_no, b.subtotal, b.discount, b.midtrans_trx_id, b.payment_method, b.deeplink_redirect, b.promo_code_applied, b.store_id
            FROM bookings b
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
                    authorization: 'Basic ' + Buffer.from(sails.config.serverKey).toString("base64")
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
            await fetch(sails.config.paymentAPIURL + bookings.rows[0].order_no + sails.config.orderTag + '/status', options)
                .then(res => res.json())
                .then(json => {
                    sails.log(json)
                    if (json.status_code == '201' || json.status_code == '200') {
                        if (paymentMethod.rows[0].payment_type == 'bank_transfer') {
                            vaNumber = json.va_numbers.filter((va) => va.bank == paymentMethod.rows[0].bank_transfer_name)[0].va_number;
                        } else if (paymentMethod.rows[0].payment_type == 'echannel') {
                            vaNumber = json.biller_code + " " + json.bill_key;
                        } else if (paymentMethod.rows[0].payment_type == 'gopay' || paymentMethod.rows[0].payment_type == 'shopeepay' || paymentMethod.rows[0].payment_type == 'credit_card') {
                            deeplinkRedirect = bookings.rows[0].deeplink_redirect;
                        }
                        isPaid = json.status_code == '200' && (json.transaction_status == 'settlement' || json.transaction_status == 'capture') && json.order_id == bookings.rows[0].order_no + sails.config.orderTag;
                    } else if (json.status_code == '407' || json.transaction_status == 'expire' || json.transaction_status == 'deny') {
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
                await sails.sendNativeQuery(`
                    UPDATE bookings
                    SET status_order = $1,
                        updated_at = $3
                    WHERE id = $2
                `, [expiredPaymentStatusId.rows[0].id, booking_id, new Date()]);

                // reset promo / coupon usage for this booking if expired
                let promoCode = bookings.rows[0].promo_code_applied;
                if (promoCode) {
                    let storeId = bookings.rows[0].store_id;
                    let currentDate = new Date();
                    let appliedPromoId;
                    let appliedCouponId;
                    let promos = await sails.sendNativeQuery(`
                        SELECT p.id, p.value, p.type, p.max_use_per_member, p.minimum_spend
                        FROM promos p
                        JOIN promo_stores ps ON ps.promo_id = p.id
                        WHERE p.code = $1 AND
                            p.status = $2 AND
                            ps.store_id = $3 AND
                            $4 BETWEEN p.start_date AND p.end_date
                    `, [promoCode, 1, storeId, currentDate]);

                    if (promos.rows.length > 0) {
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
                                cm.usage > $5
                        `, [memberId, 1, currentDate, promoCode, 0]);

                        if (coupons.rows.length > 0) {
                            appliedCouponId = coupons.rows[0].id;
                        }
                    }

                    if (appliedPromoId) {
                        // hard delete promo usage members
                        await sails.sendNativeQuery(`
                            DELETE FROM promo_usage_members 
                            WHERE promo_id = $1 AND 
                                member_id = $2 AND 
                                booking_id = $3
                        `, [appliedPromoId, memberId, booking_id]);
                    } else if (appliedCouponId) {
                        await sails.sendNativeQuery(`
                            UPDATE coupon_members
                            SET usage = usage - $1
                            WHERE id = $2
                        `, [1, appliedCouponId]);
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
            } else {
                result = {
                    redirect_url: (!isPaid) ? sails.config.paymentRedirectURL + bookings.rows[0].midtrans_trx_id : null,
                    order_id: bookings.rows[0].order_no,
                    subtotal: 'Rp. ' + await sails.helpers.numberFormat(bookings.rows[0].discount ? parseInt(bookings.rows[0].subtotal) - parseInt(bookings.rows[0].discount) : parseInt(bookings.rows[0].subtotal)),
                    virtualAccountNumber: vaNumber
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
            return sails.helpers.convertResult(0, 'Sorry your booking has expired, please create again.', null, this.res);
        }
    }
  };