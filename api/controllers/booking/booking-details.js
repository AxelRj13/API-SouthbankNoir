module.exports = {
    friendlyName: 'Get order booking details',
    inputs: {
        booking_id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({booking_id}) {
        var result = [];
        let memberId = this.req.headers['member-id'];
        let bookings = await sails.sendNativeQuery(`
            SELECT b.id, 
                s.name as store_name,
                to_char(b.reservation_date, 'Dy, DD Mon YYYY') as reservation_date,
                $3 || s.image as "store_image",
                string_agg(e.name, ', ') as events,
                contact_person_name,
                contact_person_phone,
                notes,
                discount,
                subtotal,
                promo_code_applied
            FROM bookings b
            JOIN stores s ON b.store_id = s.id
            LEFT JOIN events e ON 
                e.store_id = s.id AND
                e.status = $4 AND
                (b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date))
            WHERE b.id = $1 AND b.member_id = $2
            GROUP BY b.id, s.name, s.image, contact_person_name, contact_person_phone, notes, discount, subtotal
        `, [booking_id, memberId, sails.config.imagePath, 1]);

        if (bookings.rows.length > 0) {
            let subtotal = bookings.rows[0].discount ? parseInt(bookings.rows[0].subtotal) - parseInt(bookings.rows[0].discount) : parseInt(bookings.rows[0].subtotal);
            result = {
                booking_id: bookings.rows[0].id,
                store_name: bookings.rows[0].store_name,
                store_image: bookings.rows[0].store_image,
                events: bookings.rows[0].events ? bookings.rows[0].events : '-',
                reservation_date: bookings.rows[0].reservation_date,
                contact_person_name: bookings.rows[0].contact_person_name,
                contact_person_phone: bookings.rows[0].contact_person_phone,
                notes: bookings.rows[0].notes,
                qty: '',
                promo_code: bookings.rows[0].promo_code_applied,
                total_discount: bookings.rows[0].discount ? 'Rp. ' + await sails.helpers.numberFormat(parseInt(bookings.rows[0].discount)) : '-',
                total_payment: 'Rp. ' + await sails.helpers.numberFormat(subtotal),
                details: []
            };

            var tableQty = 0;
            for (const bookingData of bookings.rows) {
                let bookingDetails = await sails.sendNativeQuery(`
                    WITH RankedTableEvents AS (
                        SELECT t.name || ' ' || t.table_no as "table_name", 
                            COALESCE(te.capacity, t.capacity) as capacity,
                            bd.total,
                            COALESCE(te.minimum_spend, t.minimum_spend) as minimum_spend
                        FROM booking_details bd
                        JOIN bookings b ON bd.booking_id = b.id
                        JOIN tables t ON bd.table_id = t.id
                        LEFT JOIN table_events te ON t.id = te.table_id AND te.status = $2
                        LEFT JOIN events e ON 
                            te.event_id = e.id AND 
                            b.reservation_date BETWEEN date(e.start_date) AND date(e.end_date)
                        WHERE bd.booking_id = $1
                        ORDER BY t.table_no ASC
                    )
                    SELECT table_name, MAx(capacity) || ' people' AS capacity, total, MAX(minimum_spend) AS minimum_spend
                    FROM RankedTableEvents
                    GROUP BY table_name, total
                `, [booking_id, 1]);

                if (bookingDetails.rows.length > 0) {
                    tableQty += bookingDetails.rows.length;
                    for (const bookingDetailData of bookingDetails.rows) {
                        bookingDetailData.minimum_spend = 'Rp. ' + await sails.helpers.numberFormat(parseInt(bookingDetailData.minimum_spend));
                        bookingDetailData.total = 'Rp. ' + await sails.helpers.numberFormat(parseInt(bookingDetailData.total));
                        result.details.push(bookingDetailData);
                    }
                }
            }
            result.qty = tableQty + ' Table(s)';
            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Booking not Found', null, this.res);
        }
    }
  };