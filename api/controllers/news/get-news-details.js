module.exports = {
    friendlyName: 'Get details of a promo',
    inputs: {
        id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({id}) {
        let result = await sails.sendNativeQuery(`
            SELECT a.title,
                a.description,
                trim(to_char(a.created_at, 'DD Month')) || to_char(a.created_at, ' YYYY') as created_at,
                $2 || a.image as image
            FROM announcements a
            WHERE a.status = $1 AND a.id = $3
        `, [1, sails.config.imagePath, id]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows[0], this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };