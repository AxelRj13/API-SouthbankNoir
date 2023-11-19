module.exports = {
    friendlyName: 'Get my booking list based on member id',
    fn: async function () {
        var result = [];
        let memberId = this.req.headers['member-id'];
        let bookings = await sails.sendNativeQuery(`
            SELECT b.id, 
                b.order_no,
                s.name as store_name,
                so.name as status,
                t.name as table_name,
                t.capacity as table_capacity,
                to_char(b.reservation_date, 'Dy, DD Mon YYYY') as reservation_date,
                $2 || s.image as store_image,
                string_agg(e.name, ', ') as events
            FROM bookings b
            JOIN booking_details bd ON b.id = bd.booking_id
            JOIN tables t ON bd.table_id = t.id
            JOIN stores s ON b.store_id = s.id
            JOIN status_orders so ON b.status_order = so.id
            LEFT JOIN events e ON 
                e.store_id = s.id AND
                e.status = $3 AND
                (b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date))
            WHERE b.member_id = $1
            GROUP BY b.id, b.order_no, b.reservation_date, s.name, s.image, t.name, t.capacity, so.name
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
                    table_name: bookingData.table_name,
                    table_capacity: 'Max ' + bookingData.table_capacity + ' people'
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