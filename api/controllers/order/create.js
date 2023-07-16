module.exports = {

    friendlyName: 'Create sales order',
    inputs: {
        payload: {
          type: 'json',
          required: true
        }
    },
  
    fn: async function ({payload}) {
        var userId = this.req.headers.user_id;
        var storeId = this.req.headers.store_id;
        var userLoginName = this.req.headers['user-login-name'];
        if (!storeId) {
            return sails.helpers.convertResult(0, 'Harus merupakan user dari suatu toko untuk dapat membuat order.');
        }

        // check active shift
        var activeShift = await sails.sendNativeQuery(`
            SELECT id
            FROM shifts
            WHERE user_id = $1 AND 
                store_id = $2 AND
                is_active = 1
            ORDER BY created_at desc
            LIMIT 1
        `, [userId, storeId]);

        if (activeShift.rows.length < 1) {
            return sails.helpers.convertResult(0, 'Harap check in terlebih dahulu.');
        } else {
            // generate no order
            var currentDate = new Date();
            var month = currentDate.getMonth() + 1;
            var currentMonth = month < 10 ? '0'+month : month;
            var currentDateFormatYMD = currentDate.getFullYear() + '-' + currentMonth + '-' + currentDate.getDate();
            var currentDateFormatDMY = currentDate.getDate() + '-' + currentMonth + '-' + currentDate.getFullYear();
            var lastOrderNumber = await sails.sendNativeQuery(`
                SELECT nomor_transaksi
                FROM sales_orders
                WHERE "tanggalPembuatan"::date = $1
                ORDER BY id DESC
                LIMIT 1
            `, [currentDateFormatYMD]);

            var orderNumber = 'TRN-ERP-'+currentDateFormatDMY+'-001';
            if (lastOrderNumber.rows.length > 0) {
                var lastSeq = parseInt(lastOrderNumber.rows[0].nomor_transaksi.substring(19)) + 1;
                orderNumber = 'TRN-ERP-' + currentDateFormatDMY + '-' + lastSeq.toString().padStart(3, '0');
            }

            sails.log(orderNumber);

            var statusId = await sails.sendNativeQuery(`SELECT id FROM status_transaksi WHERE lower(name) = $1`, ['selesai']);
            var order = await sails.sendNativeQuery(`
                INSERT INTO sales_orders (
                    store_id, customer_id, payment_method_id, "tanggalPembuatan", pembuat, 
                    nomor_transaksi, keterangan, "subTotal", discount, ppn, 
                    "grandTotal", total, dp, jumlah_bayar, tgl_jatuh_tempo, 
                    status_order, is_pos, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id
            `, [
                storeId, payload.customer_id, payload.payment_method_id, new Date(), userLoginName, 
                orderNumber, payload.keterangan, payload.subTotal, payload.discount, payload.ppn, 
                payload.grandTotal, payload.total, payload.dp, payload.jumlah_bayar, payload.tgl_jatuh_tempo, 
                statusId.rows[0].id, 1, new Date(), new Date()
            ]);

            var summaryLocation = await sails.sendNativeQuery(`
                SELECT id
                FROM locations
                WHERE location_no = 4 AND store_id = $1
            `, [storeId]);

            var orders = payload.orders;
            for (var i = 0; i < orders.length; i++) {
                await sails.sendNativeQuery(`
                    INSERT INTO sales_order_details (sales_order, barang_id, barang_name, satuan, isi, harga, jumlah, qty_dikemas, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [order.rows[0].id, orders[i].barang_id, orders[i].barang_name, orders[i].satuan, orders[i].isi, orders[i].harga, orders[i].jumlah, orders[i].jumlah, new Date(), new Date()]);

                // adjust stock summary
                await sails.sendNativeQuery(`
                    UPDATE stock_locations
                    SET stock = stock - $1, 
                        updated_at = $2
                    WHERE barang_id = $3 AND location_id = $4
                `, [orders[i].jumlah, new Date(), orders[i].barang_id, summaryLocation.rows[0].id]);
            }

            // point setting
            var salesConfigPoint = await sails.sendNativeQuery(`
                SELECT point, point_value
                FROM sales_config_points
                WHERE lower(status) = $1 AND 
                    cast(customer_group as VARCHAR) like (SELECT '%'||customers.group_id||'%' FROM customers WHERE customers.id = $2);
            `, ['active', payload.customer_id]);

            if (salesConfigPoint.rows.length > 0) {
                var calcPoint = Math.floor(payload.grandTotal / salesConfigPoint.rows[0].point_value) * salesConfigPoint.rows[0].point;
                await sails.sendNativeQuery(`
                    UPDATE customers 
                    SET point = point + $1,
                        updated_at = $2
                    WHERE id = $3
                `, [calcPoint, new Date(), payload.customer_id]);
            }
        }

        return sails.helpers.convertResult(1, 'OK');
    }
  };