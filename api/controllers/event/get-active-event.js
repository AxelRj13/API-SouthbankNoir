module.exports = {
    friendlyName: 'Get list of active events',
    inputs: {
        keyword: {
          type: 'string',
          required: false
        }
    },
    fn: async function ({keyword}) {
        var query = `
            SELECT e.id, 
                e.name, 
                e.artist, 
                s.id as store_id,
                s.name as store_name, 
                $2 || e.image as image, 
                to_char(start_date, 'Dy, DD Mon YYYY') as date_start, 
                to_char(start_date, 'HH24:MI') as time_start,
                (
                    CASE WHEN start_date > $3
                    THEN to_char(start_date, 'YYYY-MM-DD')
                    ELSE to_char($3, 'YYYY-MM-DD')
                    END
                ) as reservation_date,
                (
                    CASE WHEN (
                            SELECT count(DISTINCT t1.id) 
                            FROM tables t1 
                            JOIN table_blueprints tb ON t1.table_blueprint_id = tb.id
                            WHERE tb.store_id = s.id AND t1.status = $1 AND tb.status = $1
                        ) = (
                            SELECT count(DISTINCT bd.table_id) 
                            FROM bookings b 
                            JOIN booking_details bd ON bd.booking_id = b.id
                            WHERE b.reservation_date = reservation_date AND b.status_order = $4
                        )
                    THEN 1
                    ELSE 0
                    END
                ) as is_fully_booked
            FROM events e 
            JOIN stores s ON e.store_id = s.id
            WHERE e.status = $1 AND 
                s.status = $1 AND 
                e.end_date >= $3
        `;

        if (keyword) {
            query += ` AND (
                (' '||e.name||' ' ILIKE '% `+keyword+` %' OR replace(e.name, ' ', '') ILIKE '%'||replace('`+keyword+`', ' ', '')||'%') OR 
                (' '||e.artist||' ' ILIKE '% `+keyword+` %' OR replace(e.artist, ' ', '') ILIKE '%'||replace('`+keyword+`', ' ', '')||'%') OR
                (' '||s.name||' ' ILIKE '% `+keyword+` %' OR replace(s.name, ' ', '') ILIKE '%'||replace('`+keyword+`', ' ', '')||'%')
            )`;
        }

        let result = await sails.sendNativeQuery(query + ` ORDER BY start_date`, [1, sails.config.imagePath, new Date(), 2]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };