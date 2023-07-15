module.exports = {
    friendlyName: 'Get list of active news / announcements',
    fn: async function () {
        let result = await sails.sendNativeQuery(`
            SELECT a.id,
                a.title,
                trim(to_char(a.created_at, 'DD Month')) || to_char(a.created_at, ' YYYY') as created_at,
                $2 || a.image as image
            FROM announcements a
            WHERE a.status = $1
            ORDER BY a.created_at
        `, [1, sails.config.imagePath]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };