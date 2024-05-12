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
        let currentDate = new Date();
        let paymentMethodObj = data.payment_method;
        if (event == 'payment.succeeded') {
            let paymentResponses = await sails.sendNativeQuery(`
                SELECT b.order_no
                FROM bookings b
                JOIN xendit_payment_responses x ON x.id = b.midtrans_trx_id
                JOIN status_orders st ON b.status_order = st.id
                WHERE x.payment_method_id = $1 AND 
                    x.id = $2 AND 
                    lower(st.name) = $3 AND 
                    lower(x.status) <> $4
            `, [paymentMethodObj.id, data.payment_request_id, 'pending payment', 'expired']);

            if (paymentResponses.rows.length > 0) {
                // update responses and booking data
                await sails.sendNativeQuery(`
                    UPDATE xendit_payment_responses
                    SET payment_id = $2, 
                        transaction_date = $3, 
                        status = $4, 
                        updated_at = $5
                    WHERE id = $1
                `, [data.payment_request_id, data.id, await sails.helpers.convertDateWithTime(data.created), 'PAID', currentDate]);

                let successStatusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['success']);
                await sails.sendNativeQuery(`
                    UPDATE bookings
                    SET status_order = $2,
                        updated_at = $3
                    WHERE order_no = $1
                `, [paymentResponses.rows[0].order_no, successStatusId.rows[0].id, currentDate])

                return sails.helpers.convertResult(1, 'Payment Request has been successfully paid', null, this.res);
            } else {
                return sails.helpers.convertResult(0, 'Payment Request cannot be found', null, this.res);
            }
        } else {
            return sails.helpers.convertResult(0, 'No event handler found for : ' + event, null, this.res);
        }
    }
  };