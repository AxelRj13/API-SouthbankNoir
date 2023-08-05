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
            date = new Date();
        }
        let layouts = await sails.sendNativeQuery(`
            SELECT tb.id, tb.name, tb.level, $3 || tb.image as "image"
            FROM table_blueprints tb
            WHERE tb.store_id = $1 AND tb.status = $2
        `, [store_id, 1, sails.config.imagePath]);

        if (layouts.rows.length > 0) {
            let storeAndDateInfo = await sails.sendNativeQuery(`
                SELECT name, to_char($2::date, 'Dy, DD Mon YYYY') as date_display
                FROM stores
                WHERE id = $1
            `, [store_id, date]);

            result = {
                store: storeAndDateInfo.rows[0].store_name,
                date_display: storeAndDateInfo.rows[0].date_display,
                date: date,
                data: []
            };
            for (const layoutData of layouts.rows) {
                let tables = await sails.sendNativeQuery(`
                    SELECT t.id, 
                        t.name, 
                        'Table ' || t.table_no as "table_no", 
                        t.capacity || ' people' as "capacity", 
                        t.down_payment,
                        t.minimum_spend,
                        (
                            CASE WHEN b.reservation_date IS NOT NULL
                            THEN
                                CASE WHEN b.reservation_date = $3 AND b.status_order = $4
                                THEN 0
                                ELSE 1
                                END
                            ELSE 1
                            END
                        ) as "is_available"
                    FROM tables t
                    LEFT JOIN booking_details bd ON t.id = bd.table_id
                    LEFT JOIN bookings b ON bd.booking_id = b.id
                    WHERE t.table_blueprint_id = $1 AND t.status = $2
                `, [layoutData.id, 1, date, 2]);

                if (tables.rows.length > 0) {
                    for (const tableData of tables.rows) {
                        tableData.minimum_spend = 'Rp. ' + await sails.helpers.numberFormat(parseInt(tableData.minimum_spend));
                        tableData.down_payment = 'Rp. ' + await sails.helpers.numberFormat(parseInt(tableData.down_payment));
                    }

                    let resultTemp = {
                        layout: layoutData.name,
                        level: layoutData.level,
                        image: layoutData.image,
                        tables: tables.rows
                    };
                    result.data.push(resultTemp);
                }
            }

            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };