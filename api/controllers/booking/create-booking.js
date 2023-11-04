module.exports = {

    friendlyName: 'Create booking',
    inputs: {
        payload: {
          type: 'json',
          required: true
        }
    },
  
    fn: async function ({payload}) {
        let memberId = this.req.headers['member-id'];
        let userLoginName = this.req.headers['user-login-name'];
        let storeId = payload.store_id;
        let bookingDetails = payload.details;

        var currentDate = new Date();
        var month = currentDate.getMonth() + 1;
        var currentMonth = month < 10 ? '0'+month : month;
        var currentDateFormatDMY = currentDate.getDate().toString() + currentMonth.toString() + currentDate.getFullYear().toString();
        var reservationDate = payload.reservation_date;
        if (!reservationDate) {
            reservationDate = currentDate;
        } else {
            let reservationDateFormatted = await sails.helpers.convertDate(new Date(reservationDate));
            let currentDateFormatted = await sails.helpers.convertDate(currentDate);
            if (reservationDateFormatted < currentDateFormatted) {
                return sails.helpers.convertResult(0, 'Date is not valid, please choose another date.', null, this.res);
            }
        }

        // booking table validation
        for (const data of bookingDetails) {
            var existingBookings = await sails.sendNativeQuery(`
                SELECT b.id
                FROM bookings b
                JOIN booking_details bd ON bd.booking_id = b.id
                WHERE b.reservation_date = $1 AND
                    bd.table_id = $2 AND 
                    b.status_order <> $3
            `, [reservationDate, data.table_id, 4]);

            if (existingBookings.rows.length > 0) {
                return sails.helpers.convertResult(0, 'Table already booked, please try another table or change the date.', null, this.res);
            }
        }

        // generate no order
        var lastOrderNumber = await sails.sendNativeQuery(`
            SELECT order_no
            FROM bookings
            WHERE created_at::date = $1
            ORDER BY id DESC
            LIMIT 1
        `, [currentDate]);

        var orderNumber = 'TRN-SBN-'+currentDateFormatDMY.padStart(8, '0')+'-001';
        if (lastOrderNumber.rows.length > 0) {
            var lastSeq = parseInt(lastOrderNumber.rows[0].order_no.substring(19)) + 1;
            orderNumber = 'TRN-SBN-' + currentDateFormatDMY.padStart(8, '0') + '-' + lastSeq.toString().padStart(3, '0');
        }

        let member = await sails.sendNativeQuery(`SELECT phone FROM members WHERE id = $1 AND status = $2`, [memberId, 1]);
        if (member.rows.length <= 0) {
            return sails.helpers.convertResult(0, 'Member Not Found / Inactive', null, this.res);
        }
        var cpPhone = member.rows[0].phone;

        let statusId = await sails.sendNativeQuery(`SELECT id FROM status_orders WHERE lower(name) = $1`, ['new']);
        let booking = await sails.sendNativeQuery(`
            INSERT INTO bookings (
                store_id, member_id, status_order, order_no, reservation_date, 
                contact_person_name, contact_person_phone, created_by, updated_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $9)
            RETURNING id
        `, [
            storeId, memberId, statusId.rows[0].id, orderNumber, reservationDate,
            userLoginName, cpPhone, memberId, new Date()
        ]);

        var subtotal = 0;
        for (var i = 0; i < bookingDetails.length; i++) {
            await sails.sendNativeQuery(`
                INSERT INTO booking_details (booking_id, table_id, total, created_by, updated_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $4, $5, $5)
            `, [booking.rows[0].id, bookingDetails[i].table_id, bookingDetails[i].total, memberId, new Date()]);

            subtotal += bookingDetails[i].total;
        }

        // update subtotal
        await sails.sendNativeQuery(`
            UPDATE bookings
            SET subtotal = $1,
                updated_at = $2
            WHERE id = $3
        `, [subtotal, new Date(), booking.rows[0].id]);

        // point setting
        // var salesConfigPoint = await sails.sendNativeQuery(`
        //     SELECT point, point_value
        //     FROM sales_config_points
        //     WHERE lower(status) = $1 AND 
        //         cast(customer_group as VARCHAR) like (SELECT '%'||customers.group_id||'%' FROM customers WHERE customers.id = $2);
        // `, ['active', payload.customer_id]);

        // if (salesConfigPoint.rows.length > 0) {
        //     var calcPoint = Math.floor(payload.grandTotal / salesConfigPoint.rows[0].point_value) * salesConfigPoint.rows[0].point;
        //     await sails.sendNativeQuery(`
        //         UPDATE customers 
        //         SET point = point + $1,
        //             updated_at = $2
        //         WHERE id = $3
        //     `, [calcPoint, new Date(), payload.customer_id]);
        // }

        return sails.helpers.convertResult(1, 'Booking Successfully Created', {id: booking.rows[0].id}, this.res);
    }
  };