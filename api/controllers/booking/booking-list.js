module.exports = {
    friendlyName: 'Get my booking list based on member id',
    fn: async function () {
        let memberId = this.req.headers['member-id'];
        let bookings = await sails.sendNativeQuery(`
            WITH TableCapacityCTE AS (
                SELECT bd.booking_id, SUM(t.capacity) as total_table_capacity
                FROM booking_details bd
                JOIN tables t ON bd.table_id = t.id
                GROUP BY bd.booking_id
            )
            SELECT b.id, 
                b.order_no,
                s.name as store_name,
                so.name as status,
                string_agg(DISTINCT t.name || ' ' || t.table_no, ' | ') as table_name,
                tc.total_table_capacity as table_capacity,
                to_char(b.reservation_date, 'Dy, DD Mon YYYY') as reservation_date,
                $2 || s.image as store_image,
                string_agg(DISTINCT e.name, ', ') as events,
                to_char(b.created_at, 'DD Mon YYYY, HH24:MI') as created_date,
                to_char(b.expiry_date, 'DD Mon YYYY, HH24:MI') as expiry_date,
                b.deeplink_redirect
            FROM bookings b
            JOIN TableCapacityCTE tc ON b.id = tc.booking_id
            JOIN booking_details bd ON b.id = bd.booking_id
            JOIN tables t ON bd.table_id = t.id
            JOIN stores s ON b.store_id = s.id
            JOIN status_orders so ON b.status_order = so.id
            LEFT JOIN events e ON 
                e.store_id = s.id AND
                e.status = $3 AND
                (b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date))
            WHERE b.member_id = $1
            GROUP BY b.id, b.order_no, b.reservation_date, s.name, s.image, so.name, tc.total_table_capacity
            ORDER BY b.reservation_date DESC, b.order_no DESC
        `, [memberId, sails.config.imagePath, 1]);

        if (bookings.rows.length > 0) {
            let dateGroup = [];
            var list = [];
            var dateTemp = null;
            for (const bookingData of bookings.rows) {
                if (dateTemp !== bookingData.reservation_date) {
                    if (dateTemp) {
                        dateGroup.push({
                            date: dateTemp,
                            bookings: list
                        });
                        list = [];
                    }
                    dateTemp = bookingData.reservation_date;
                }
                
                list.push({
                    booking_id: bookingData.id,
                    booking_no: bookingData.order_no,
                    status: bookingData.status,
                    store_name: bookingData.store_name,
                    store_image: bookingData.store_image,
                    events: bookingData.events ? bookingData.events : '-',
                    reservation_date: bookingData.reservation_date,
                    created_date: bookingData.created_date,
                    expiry_date: (bookingData.status.toLowerCase() == 'pending payment') ? bookingData.expiry_date : null,
                    table_name: bookingData.table_name,
                    table_capacity: 'Max ' + bookingData.table_capacity + ' people',
                    redirect_url: bookingData.deeplink_redirect
                });
            }

            // push to the table group for final index
            dateGroup.push({
                date: dateTemp,
                bookings: list
            });

            return sails.helpers.convertResult(1, '', dateGroup, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Bookings not Found', null, this.res);
        }
    }
  };