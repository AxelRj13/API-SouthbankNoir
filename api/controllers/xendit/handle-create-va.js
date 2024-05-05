module.exports = {
    friendlyName: 'Handle callback event from xendit when VA is created',
    inputs: {
        id: {
          type: 'string',
          required: true
        },
        external_id: {
            type: 'string',
            required: true
        },
        name: {
            type: 'string',
            required: true
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
        expiration_date: {
            type: 'string',
            required: true
        },
        status: {
            type: 'string',
            required: true
        },
        expected_amount: {
            type: 'number',
            required: true
        }
    },
    fn: async function ({id, external_id, name, account_number, bank_code, merchant_code, expiration_date, status, expected_amount}) {
        let currentDate = new Date();
        let vaResponses = await sails.sendNativeQuery(`
            SELECT x.id
            FROM xendit_va_responses x
            WHERE x.id = $1
        `, [id]);
        if (vaResponses.rows.length > 0) {
            return sails.helpers.convertResult(0, 'Something wrong with the VA creation process, ID is already exist. Please try again later.', null, this.res);
        } else {
            await sails.sendNativeQuery(`
                INSERT INTO xendit_va_responses (
                    id, external_id, account_name, account_number,
                    bank_code, merchant_code, expiration_date, amount, status,
                    created_by, updated_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $11)
            `, [
                id, external_id, name, account_number, 
                bank_code, merchant_code, expiration_date, expected_amount, status,
                1, currentDate
            ]);
            return sails.helpers.convertResult(1, 'VA is successfully created!', null, this.res);
        }
    }
  };