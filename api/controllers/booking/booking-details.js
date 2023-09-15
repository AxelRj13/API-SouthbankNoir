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
                e.start_date <= $5 AND e.end_date >= $5
            WHERE b.id = $1 AND b.member_id = $2
            GROUP BY b.id, s.name, s.image, contact_person_name, contact_person_phone, notes, discount, subtotal
        `, [booking_id, memberId, sails.config.imagePath, 1, new Date()]);

        if (bookings.rows.length > 0) {
            result = {
                booking_id: bookings.rows[0].id,
                store_name: bookings.rows[0].store_name,
                events: bookings.rows[0].events,
                reservation_date: bookings.rows[0].reservation_date,
                contact_person_name: bookings.rows[0].contact_person_name,
                contact_person_phone: bookings.rows[0].contact_person_phone,
                notes: bookings.rows[0].notes,
                qty: '',
                promo_code: bookings.rows[0].promo_code_applied,
                total_discount: bookings.rows[0].discount ? 'Rp. ' + await sails.helpers.numberFormat(parseInt(bookings.rows[0].discount)) : '-',
                total_payment: 'Rp. ' + await sails.helpers.numberFormat(parseInt(bookings.rows[0].subtotal)),
                details: []
            };

            var tableQty = 0;
            for (const bookingData of bookings.rows) {
                let bookingDetails = await sails.sendNativeQuery(`
                    SELECT t.name || ' ' || t.table_no as "table_name", 
                        t.capacity || ' people' as "capacity",
                        bd.total,
                        t.minimum_spend
                    FROM booking_details bd
                    JOIN tables t ON bd.table_id = t.id
                    WHERE bd.booking_id = $1
                    ORDER BY t.table_no ASC
                `, [booking_id]);

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
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };