module.exports = {
    friendlyName: 'Get active today events',
    fn: async function () {
        let events = await sails.sendNativeQuery(`
            SELECT e.store_id, e.name as store_name, e.artist, s.name, ($1 || e.image) as event_image, e.start_date, e.end_date
            FROM events e
            JOIN stores s ON e.store_id = s.id
            WHERE e.status = $2 AND date(e.start_date) = $3
            ORDER BY e.start_date
        `, [sails.config.imagePath, 1, new Date()]);

        if (events.rows.length > 0) {
            return sails.helpers.convertResult(1, '', events.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };
  