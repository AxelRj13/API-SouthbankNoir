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
        let failedPaymentStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['failed']);
        let bookings = await sails.sendNativeQuery(`
            SELECT b.order_no, b.subtotal, b.discount, b.midtrans_trx_id, b.payment_method, b.deeplink_redirect
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
                        } else if (paymentMethod.rows[0].payment_type == 'gopay' || paymentMethod.rows[0].payment_type == 'shopeepay') {
                            deeplinkRedirect = bookings.rows[0].deeplink_redirect;
                        }
                        isPaid = json.status_code == '200' && json.transaction_status == 'settlement' && json.order_id == bookings.rows[0].order_no + sails.config.orderTag;
                    } else if (json.status_code == '407' || json.transaction_status == 'expire') {
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
                `, [failedPaymentStatusId.rows[0].id, booking_id, new Date()]);
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
            return sails.helpers.convertResult(0, 'Booking not found', null, this.res);
        }
    }
  };