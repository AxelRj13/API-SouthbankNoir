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
            SELECT b.order_no, b.subtotal, b.discount, b.midtrans_trx_id
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
                    authorization: 'Basic ' + sails.config.serverKeyBase64
                }
            };
            var isError = false;
            var isExpired = false;
            var errorMsg;
            let vaNumber;
            await fetch(sails.config.paymentAPIURL + bookings.rows[0].order_no + '/status', options)
                .then(res => res.json())
                .then(json => {
                    if (json.status_code == '201') {
                        vaNumber = json.va_numbers.filter((va) => va.bank == 'bca')[0].va_number;
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

            result = {
                redirect_url: sails.config.paymentRedirectURL + bookings.rows[0].midtrans_trx_id,
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

            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Booking not found', null, this.res);
        }
    }
  };