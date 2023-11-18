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
        let bookings = await sails.sendNativeQuery(`
            SELECT b.order_no, b.subtotal, b.discount
            FROM bookings b
            WHERE b.id = $1 AND b.status_order = $2 AND b.member_id = $3
        `, [booking_id, pendingPaymentStatusId.rows[0].id, memberId]);

        if (bookings.rows.length > 0) {
            result = {
                order_id: bookings.rows[0].order_no,
                subtotal: 'Rp. ' + await sails.helpers.numberFormat(bookings.rows[0].discount ? parseInt(bookings.rows[0].subtotal) - parseInt(bookings.rows[0].discount) : parseInt(bookings.rows[0].subtotal)),
                virtualAccountNumber: '89xxxxxxxxx'
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