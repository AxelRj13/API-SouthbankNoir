module.exports = {
    friendlyName: 'Get active splashscreen',
    fn: async function () {
        let result = await sails.sendNativeQuery(`
            SELECT value
            FROM configurations
            WHERE name = $1 AND status = $2
        `, ['splash_screen', 1]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', sails.config.imagePath + result.rows[0].value, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };