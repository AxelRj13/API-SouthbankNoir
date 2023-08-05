module.exports = {
    friendlyName: 'Get list of tables and layout',
    inputs: {
        store_id: {
          type: 'number',
          required: true
        },
        date: {
          type: 'string',
          required: true
        },
    },
    fn: async function ({store_id, date}) {
        var result = [];
        let layouts = await sails.sendNativeQuery(`
            SELECT id, name, level, $3 || image as "image"
            FROM table_blueprints
            WHERE store_id = $1 AND status = $2
        `, [store_id, 1, sails.config.imagePath]);

        if (layouts.rows.length > 0) {
            if (!date) {
                date = new Date();
            }
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
                    result.push(resultTemp);
                }
            }

            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };