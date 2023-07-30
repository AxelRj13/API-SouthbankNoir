module.exports = {
    friendlyName: 'Get list of tables and layout',
    inputs: {
        store_id: {
          type: 'number',
          required: true
        }
    },
    fn: async function ({store_id}) {
        var result = [];
        let layouts = await sails.sendNativeQuery(`
            SELECT id, name, level, $3 || image as "image"
            FROM table_blueprints
            WHERE store_id = $1 AND status = $2
        `, [store_id, 1, sails.config.imagePath]);

        if (layouts.rows.length > 0) {
            for (const layoutData of layouts.rows) {
                let tables = await sails.sendNativeQuery(`
                    SELECT id, 
                        name, 
                        'Table ' || table_no as "table_no", 
                        capacity || ' people' as "capacity", 
                        down_payment,
                        minimum_spend
                    FROM tables 
                    WHERE table_blueprint_id = $1 AND status = $2
                `, [layoutData.id, 1]);

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