module.exports = {
    friendlyName: 'Get active promotion popup banner for homepage',
    fn: async function () {
        let promos = await sails.sendNativeQuery(`
            SELECT title, $1 || image as banner_image, start_date
            FROM promos
            WHERE status = $2 AND end_date >= $3
            ORDER BY start_date
        `, [sails.config.imagePath, 1, new Date()]);

        if (promos.rows.length > 0) {
            return sails.helpers.convertResult(1, '', promos.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };
  