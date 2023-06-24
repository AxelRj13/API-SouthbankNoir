module.exports = {

    friendlyName: 'Get all active categories',
    inputs: {
        category_id: {
          type: 'string',
          required: false
        }
    },
    exits: {
        success: {
            description: 'Success get all categories.'
        },
        notFound: {
            description: 'No active category records found in the database.',
            responseType: 'notFound'
        }
    },
  
    fn: async function ({category_id}) {
        var query = `
            SELECT id, code, category_name
            FROM categories
            WHERE is_active = $1
        `;
        
        if (category_id) {
            query += ` AND parent_id = `+category_id;
        } else {
            query += ` AND level = 1`;
        }

        var result = await sails.sendNativeQuery(query, [1]);
        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };