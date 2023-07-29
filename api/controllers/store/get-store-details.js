module.exports = {
    friendlyName: 'Get store operational hours',
    inputs: {
        store_id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({store_id}) {
        let result = {};

        let store = await sails.sendNativeQuery(`
            SELECT name,
                address,
                $1 || latitude || ',' || longitude as "direction",
                $2 || phone || $3 as "phone",
                $4 || image as "image"
            FROM stores
            WHERE id = $5
        `, [
            'https://www.google.com/maps/dir/?api=1&destination=',
            'https://api.whatsapp.com/send/?phone=',
            '&text&type=phone_number&app_absent=0',
            sails.config.imagePath,
            store_id
        ]);

        if (store.rows.length > 0) {
            result.store = store.rows;
            let operationalHours = await sails.sendNativeQuery(`
                SELECT INITCAP(day) as "day",
                    (
                        CASE WHEN status = 0 
                        THEN 'CLOSED'
                        ELSE open || ' - ' || close
                        END
                    ) as "hour"
                FROM store_opening_hours
                WHERE store_id = $1
                ORDER BY id asc
            `, [store_id]);

            if (operationalHours.rows.length > 0) {
                
                let date = new Date();
                let day = date.toLocaleDateString('id-ID', { weekday: 'long' });

                for (const data of operationalHours.rows) {

                    data.is_today = false;
                    data.is_open = false;

                    if (day == data.day) {

                        data.is_today = true;
                        
                        if (data.hour !== 'CLOSED') {
                            let currentOprHour = await sails.sendNativeQuery(`
                                SELECT open, close
                                FROM store_opening_hours
                                WHERE store_id = $1 AND day = $2
                            `, [store_id, day.toLowerCase()]);

                            let openArr = currentOprHour.rows[0].open.split(":");
                            let closeArr = currentOprHour.rows[0].close.split(":");
                            var openHour = new Date();
                            openHour.setHours(openArr[0], openArr[1], 0);
                            var closeHour = new Date();
                            closeHour.setHours(closeArr[0], closeArr[1], 0);
                            if (closeHour < openHour) {
                                closeHour.setDate(closeHour.getDate() + 1);
                            }

                            data.is_open = (date >= openHour) && (date < closeHour);
                        }
                    }
                }
                result.operational_hours = operationalHours.rows;
                return sails.helpers.convertResult(1, '', result, this.res);
            } else {
                return sails.helpers.convertResult(0, 'Not Found');
            }
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };