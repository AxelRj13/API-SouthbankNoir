module.exports = {
    friendlyName: 'Get list of tables and layout',
    inputs: {
        store_id: {
          type: 'number',
          required: true
        },
        date: {
          type: 'string',
          required: false
        },
    },
    fn: async function ({store_id, date}) {
        var result = [];
        if (!date) {
            date = await sails.helpers.convertDate(new Date());
        }
        let layouts = await sails.sendNativeQuery(`
            SELECT tb.id, tb.name, tb.level, $3 || tb.image as "image"
            FROM table_blueprints tb
            WHERE tb.store_id = $1 AND tb.status = $2
        `, [store_id, 1, sails.config.imagePath]);

        if (layouts.rows.length > 0) {
            let storeAndDateInfo = await sails.sendNativeQuery(`
                SELECT s.id, s.name, to_char($2::date, 'Dy, DD Mon YYYY') as date_display, string_agg(e.name, ', ') as events
                FROM stores s
                LEFT JOIN events e ON s.id = e.store_id AND 
                    ($2 BETWEEN date(e.start_date) AND date(e.end_date)) AND 
                    e.status = $3
                WHERE s.id = $1
                GROUP BY s.id, s.name
            `, [store_id, date, 1]);

            result = {
                store_id: storeAndDateInfo.rows[0].id,
                store_name: storeAndDateInfo.rows[0].name,
                date_display: storeAndDateInfo.rows[0].date_display,
                date: date,
                events: storeAndDateInfo.rows[0].events ? storeAndDateInfo.rows[0].events : '-',
                list: []
            };
            
            for (const layoutData of layouts.rows) {
                let tables = await sails.sendNativeQuery(`
                    SELECT t.id,
                        t.name,
                        t.table_no,
                        'Table ' || t.table_no as "table_no",
                        t.capacity || ' people' as "capacity",
                        t.down_payment,
                        t.minimum_spend,
                        (
                            CASE WHEN (
                                SELECT b.id
                                FROM bookings b
                                JOIN booking_details bd ON b.id = bd.booking_id AND t.id = bd.table_id
                                WHERE b.status_order IN (SELECT so.id FROM status_orders so WHERE lower(so.name) IN ('pending payment', 'success')) AND b.reservation_date = $3
                            ) IS NOT NULL
                            THEN 0
                            ELSE 1
                            END
                        ) as "is_available"
                    FROM tables t
                    WHERE t.table_blueprint_id = $1 AND t.status = $2
                    ORDER BY t.name, t.table_no ASC;
                `, [layoutData.id, 1, date]);

                if (tables.rows.length > 0) {
                    let tableGroup = [];
                    var tableList = [];
                    var tableNameTemp = null;
                    for (const tableData of tables.rows) {
                        if (tableNameTemp !== tableData.name) {
                            if (tableNameTemp) {
                                tableGroup.push({
                                    name: tableNameTemp,
                                    tables: tableList
                                });
                                tableList = [];
                            }
                            tableNameTemp = tableData.name;
                        }
                        tableData.down_payment_number = tableData.down_payment;
                        tableData.down_payment = 'Rp. ' + await sails.helpers.numberFormat(parseInt(tableData.down_payment));
                        tableData.minimum_spend = 'Rp. ' + await sails.helpers.numberFormat(parseInt(tableData.minimum_spend));
                        tableList.push({
                            id: tableData.id,
                            table_no: tableData.table_no,
                            capacity: tableData.capacity,
                            down_payment: tableData.down_payment,
                            down_payment_number: tableData.down_payment_number,
                            minimum_spend: tableData.minimum_spend,
                            is_available: tableData.is_available
                        });
                    }

                    // push to the table group for final index
                    tableGroup.push({
                        name: tableNameTemp,
                        tables: tableList
                    });

                    result.list.push({
                        layout: layoutData.name,
                        level: layoutData.level,
                        table: tableGroup
                    });
                }
            }

            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found', null, this.res);
        }
    }
  };