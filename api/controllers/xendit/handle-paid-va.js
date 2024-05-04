module.exports = {
    friendlyName: 'Handle callback event from xendit after VA is paid',
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
        account_number: {
            type: 'string',
            required: true
        },
        bank_code: {
            type: 'string',
            required: true
        },
        merchant_code: {
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
    fn: async function ({id, external_id, payment_id, account_number, bank_code, merchant_code, transaction_timestamp, amount}) {
        let currentDate = new Date();
        await sails.sendNativeQuery(`
            INSERT INTO xendit_va_responses (
                id, external_id, payment_id, account_name, account_number,
                bank_code, merchant_code, transaction_date, status, amount,
                created_by, updated_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $12)
        `, [
            id, external_id, payment_id, 'test_callback', account_number, 
            bank_code, merchant_code, transaction_timestamp, 'PAID', amount, 
            1, currentDate
        ]);
        return sails.helpers.convertResult(1, 'OK', {}, this.res);
    }
  };