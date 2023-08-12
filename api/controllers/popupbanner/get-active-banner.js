module.exports = {
    friendlyName: 'Get active popup banner',
    fn: async function () {
        let popupBanner = await sails.sendNativeQuery(`
            SELECT name, image
            FROM popup_banners
            WHERE status = $1 AND 
                $2 BETWEEN start_date AND end_date
            LIMIT 1
        `, [1, new Date()]);

        if (popupBanner.rows.length > 0) {
            popupBanner.rows[0].image = sails.config.imagePath + popupBanner.rows[0].image;
            return sails.helpers.convertResult(1, '', popupBanner.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };
  