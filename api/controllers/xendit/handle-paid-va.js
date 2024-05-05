module.exports = {
    friendlyName: 'Handle callback event from xendit when VA is paid',
    inputs: {
        id: {
          type: 'string',
          required: true
        },
        external_id: {
            type: 'string',
            required: true
        },
        payment_id: {
            type: 'string',
            required: false
        },
        merchant_code: {
            type: 'string',
            required: true
        },
        account_number: {
            type: 'string',
            required: true
        },
        transaction_timestamp: {
            type: 'string',
            required: true
        },
        amount: {
            type: 'number',
            required: true
        },
    },
    fn: async function ({id, external_id, payment_id, merchant_code, account_number, transaction_timestamp, amount}) {
        let currentDate = new Date();
        let vaNumber = merchant_code + account_number;
        let vaResponses = await sails.sendNativeQuery(`
            SELECT x.id
            FROM xendit_va_responses x
            WHERE x.id = $1 AND external_id = $2 AND account_number = $3
        `, [id, external_id, vaNumber]);
        if (vaResponses.rows.length > 0) {
            await sails.sendNativeQuery(`
                UPDATE xendit_va_responses
                SET payment_id = $4,
                    amount = $5, 
                    transaction_date = $6,
                    status = $7,
                    updated_at = $8
                WHERE id = $1 AND 
                    external_id = $2 AND 
                    account_number = $3
            `, [id, external_id, vaNumber, payment_id, amount, await sails.helpers.convertDateWithTime(transaction_timestamp), 'PAID', currentDate]);

            return sails.helpers.convertResult(1, 'VA is successfully paid!', null, this.res);
        } else {
            return sails.helpers.convertResult(0, 'VA number is not exist, please try create again.', null, this.res);
        }
    }
  };