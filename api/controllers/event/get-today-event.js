module.exports = {
    friendlyName: 'Get active today events',
    fn: async function () {
        let result = await sails.sendNativeQuery(`
            SELECT e.id, 
                e.name, 
                e.artist, 
                s.id as store_id,
                s.name as store_name, 
                $2 || e.image as image, 
                (
                    CASE WHEN date(start_date) = date(end_date)
                    THEN to_char(start_date, 'Dy, DD Mon YYYY')
                    ELSE 
                        CASE WHEN to_char(start_date, 'YYYY') = to_char(end_date, 'YYYY')
                        THEN to_char(start_date, 'Dy, DD Mon') || ' - ' || to_char(end_date, 'Dy, DD Mon YYYY')
                        ELSE to_char(start_date, 'Dy, DD Mon YYYY') || ' - ' || to_char(end_date, 'Dy, DD Mon YYYY')
                        END
                    END
                ) as date_start,
                to_char(e.start_date, 'HH24:MI') as time_start,
                (
                    CASE WHEN e.start_date > $3
                    THEN to_char(e.start_date, 'YYYY-MM-DD')
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
                            WHERE b.reservation_date = reservation_date AND b.status_order IN (SELECT id FROM status_orders WHERE lower(name) IN ('success', 'pending payment'))
                        )
                    THEN 1
                    ELSE 0
                    END
                ) as is_fully_booked
            FROM events e 
            JOIN stores s ON e.store_id = s.id
            WHERE e.status = $1 AND 
                s.status = $1 AND 
                (
                    $3 BETWEEN e.start_date AND e.end_date OR 
                    date($3) = date(e.start_date)
                )
        `, [1, sails.config.imagePath, await sails.helpers.convertDateWithTime(new Date())]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };
  