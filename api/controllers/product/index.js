module.exports = {

    friendlyName: 'Get all product',
    inputs: {
        customer_id: {
          type: 'number',
          required: true
        },
        name: {
          type: 'string',
          required: false
        },
        sku: {
          type: 'string',
          required: false
        },
        article_code: {
          type: 'string',
          required: false
        },
        satuan: {
          type: 'string',
          required: false
        },
        category: {
          type: 'string',
          required: false
        },
        supplier: {
          type: 'string',
          required: false
        },
        priceFrom: {
          type: 'string',
          required: false
        },
        priceTo: {
          type: 'string',
          required: false
        }
    },
    exits: {
        success: {
            description: 'Success get all products.'
        },
        notFound: {
            description: 'No active product records found in the database.',
            responseType: 'notFound'
        }
    },
  
    fn: async function ({customer_id, name, sku, article_code, satuan, category, supplier, priceFrom, priceTo}) {
        var storeId = this.req.headers.store_id;
        var jenisHarga = await sails.sendNativeQuery(`
            SELECT cg.jenis_harga_id
            FROM customers c
            JOIN customer_groups cg ON c.group_id = cg.id
            WHERE c.id = $1 and c.status = $2 and cg.status = $2
        `, [customer_id, 1]);

        var jenisHargaId = 7; //default
        if (jenisHarga.rows.length > 0) {
            jenisHargaId = jenisHarga.rows[0].jenis_harga_id;
        }

        var query = `
            SELECT b.id, b.nama, b."articleCode", b.sku, c.category_name as "category", hj.harga_jual, hj.harga_diskon, s.satuan, s.isi, sl.stock, supp.nama as "supplier"
            FROM barang b
            JOIN barang_store bs ON b.id = bs.barang_id
            JOIN category_product cp ON b.id = cp.product_id
            JOIN categories c ON cp.category_id = c.id
            JOIN satuans s on b.satuan_id = s.id
            JOIN harga_jual hj on b.id = hj.barang_id
            JOIN stock_locations sl on b.id = sl.barang_id
            JOIN locations l on sl.location_id = l.id
            LEFT JOIN supplier supp on b.supplier_id = supp.id
            WHERE b.active = $1 and
                bs.store_id = $2 and
                hj.store_id = $2 and
                hj.active = $1 and
                c.is_active = $1 and
                hj.jenis_harga_id = $3 and
                l.store_id = $2 and
                l.location_no = $4
        `;

        if (name) {
            query += ` and (' '||b.nama||' ' ILIKE '% `+name+` %' OR replace(b.nama, ' ', '') ILIKE '%'||replace('`+name+`', ' ', '')||'%')`;
        }

        if (sku) {
            query += ` and b.sku ILIKE '%`+sku+`%'`;
        }

        if (article_code) {
            query += ` and b."articleCode" = '`+article_code+`'`;
        }

        if (satuan) {
            query += ` and b.satuan_id = `+satuan;
        }

        if (category) {
            var categoryQuery = category;
            var categoryTemp = await sails.sendNativeQuery(`SELECT level FROM categories WHERE id = $1 AND is_active = $2`, [category, 1]);
            if (categoryTemp.rows.length > 0) {
                if (categoryTemp.rows[0].level == 1) {
                    var categoryTemp2 = await sails.sendNativeQuery(`SELECT id FROM categories WHERE parent_id = $1 AND is_active = $2`, [category, 1]);
                    for (var i = 0; i < categoryTemp2.rows.length; i++) {
                        categoryQuery += ','+categoryTemp2.rows[i].id;
                        var categoryTemp3 = await sails.sendNativeQuery(`SELECT id FROM categories WHERE parent_id = $1 AND is_active = $2`, [categoryTemp2.rows[i].id, 1]);
                        for (var i = 0; i < categoryTemp3.rows.length; i++) {
                            categoryQuery += ','+categoryTemp3.rows[i].id;
                        }
                    }
                } else if (categoryTemp.rows[0].level == 2) {
                    var categoryTemp3 = await sails.sendNativeQuery(`SELECT id FROM categories WHERE parent_id = $1 AND is_active = $2`, [category, 1]);
                    for (var i = 0; i < categoryTemp3.rows.length; i++) {
                        categoryQuery += ','+categoryTemp3.rows[i].id;
                    }
                }
                query += ` and c.id IN ('`+categoryQuery+`')`;
            }
        }

        if (supplier) {
            query += ` and supp.active = 1 and b.supplier_id = `+supplier;
        }

        if (priceFrom && priceFrom > 0) {
            query += ` and hj.harga_jual >= `+priceFrom;
        }

        if (priceTo && priceTo > 0) {
            query += ` and hj.harga_jual <= `+priceTo;
        }

        query += ` ORDER BY b.nama;`
        var result = await sails.sendNativeQuery(query, [1, storeId, jenisHargaId, 4]);
        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };