let PHPUnserialize = require('php-unserialize');

module.exports = {

    friendlyName: 'Check promo for specific product',
    inputs: {
        barang_id: {
          type: 'string',
          required: true
        },
        customer_id: {
          type: 'string',
          required: false
        },
        harga_jual: {
          type: 'number',
          required: true
        },
        jumlah: {
          type: 'number',
          required: false
        }
    },
  
    fn: async function ({barang_id, customer_id, harga_jual, jumlah}) {
        var storeId = this.req.headers.store_id;
        // get customer group
        var customerGroupId = 2; //default
        var customerId = customer_id;
        if (customerId) {
            var qCustomerGroup = await sails.sendNativeQuery(`
                SELECT group_id
                FROM customers
                JOIN customer_groups cg ON customers.group_id = cg.id
                WHERE customers.id = $1 AND cg.status = $2 AND enable_on_pos = $2
            `, [customerId, 1]);

            if (qCustomerGroup.rows.length > 0) {
                customerGroupId = qCustomerGroup.rows[0].group_id;
            }
        } else {
            customerId = 0;
        }

        let qProductCategoryId = await sails.sendNativeQuery(`SELECT category_id FROM category_product WHERE product_id = $1`, [barang_id]);

        let getPotongan = await sails.sendNativeQuery(`
            SELECT sales_rules_price.nama_promo, sales_rules_price.keterangan_potongan as potongan 
            FROM sales_rules_price 
            WHERE sales_rules_price.keterangan_kategori_produk LIKE $1 AND 
                sales_rules_price.customer_group_id = $2
        `, ['%'+qProductCategoryId.rows[0].category_id+'%', customerGroupId]);

        let getPotonganAll = await sails.sendNativeQuery(`
            SELECT sales_rules_price.nama_promo, sales_rules_price.keterangan_potongan as potongan 
            FROM sales_rules_price 
            WHERE sales_rules_price.keterangan_kategori_produk ilike '%All%' AND 
                sales_rules_price.customer_group_id = $1
        `, [customerGroupId]);

        var potongan = parseInt(harga_jual);
        var potonganArr;
        if (getPotongan.rows.length < 1 && getPotonganAll.rows.length > 0) {
            potonganArr = getPotonganAll.rows[0].potongan.split(',');
        } else if (getPotongan.rows.length > 0 && getPotonganAll.rows.length > 0) {
            potonganArr = getPotongan.rows[0].potongan.split(',').concat(getPotonganAll.rows[0].potongan.split(','));
        }

        for (var i = 0; i < potonganArr.length; i++) {
            potongan -= (potongan * (parseInt(potonganArr[i]) / 100));
        }

        var jenisHarga = await sails.sendNativeQuery(`
            SELECT cg.jenis_harga_id
            FROM customers c
            JOIN customer_groups cg ON c.group_id = cg.id
            WHERE c.id = $1 and c.status = $2 and cg.status = $2
        `, [customerId, 1]);

        var jenisHargaId = 16; //default
        if (jenisHarga.rows.length > 0) {
            jenisHargaId = jenisHarga.rows[0].jenis_harga_id;
        }

        let date = new Date().toJSON().slice(0, 10); // date format y-m-d
        var hargaDisc = await sails.sendNativeQuery(`
            SELECT harga_diskon
            FROM harga_jual
            WHERE barang_id = $1 AND 
                active = 1 AND 
                jenis_harga_id = $2 AND 
                store_id = $3 AND 
                tgl_mulai <= $4 AND tgl_akhir >= $4 AND 
                harga_diskon IS NOT NULL
        `, [barang_id, jenisHargaId, storeId, date]);

        if (hargaDisc.rows.length > 0) {
            potongan -= hargaDisc.rows[0].harga_diskon;
        }

        var barangPromoTemp = {};
        var qtyPromoTemp = {};
        var qtyPromoReal;
        var discount = {};
        var promo = [];

        let activeSalesRule = await sails.sendNativeQuery(`
            SELECT 
                sales_rules.id, sales_rules.barang_id, sales_rules.discount_step,
                sales_rules.discount_amount, sales_rules.name, sales_rule_customer_groups.customer_group_id, 
                sales_rule_rule.sku_asal, sales_rule_rule.sku_promo, sales_rule_rule.qty_asal, sales_rule_rule.qty_promo,
                sales_rules.uses_per_customer, COALESCE(sales_rules.minimum_subtotal, 0) as minimum_subtotal 
            FROM sales_rules 
            left join sales_rule_rule on sales_rules.id = sales_rule_rule.sales_rule_id 
            left join sales_rule_customer_groups on sales_rule_rule.id = sales_rule_customer_groups.sales_rule_id 
            left join sales_rule_coupon on sales_rule_rule.id = sales_rule_coupon.sales_rule_id 
            where sales_rules.to_date >= $1 AND 
                sales_rules.status = $2 AND 
                sales_rule_customer_groups.customer_group_id LIKE $3
        `, [date, 1, '%'+customerGroupId+'%']);

        if (activeSalesRule.rows.length > 0) {

            for (var i = 0; i < activeSalesRule.rows.length; i++) {
                let salesRuleBarang = Object.values(PHPUnserialize.unserialize(activeSalesRule.rows[i].barang_id));
                let skuAsal = Object.values(PHPUnserialize.unserialize(activeSalesRule.rows[i].sku_asal));
                let skuPromo = Object.values(PHPUnserialize.unserialize(activeSalesRule.rows[i].sku_promo));
                let qtyAsal = Object.values(PHPUnserialize.unserialize(activeSalesRule.rows[i].qty_asal));
                let qtyPromo = Object.values(PHPUnserialize.unserialize(activeSalesRule.rows[i].qty_promo));

                if (skuAsal) {
                    var custGroup = Object.values(PHPUnserialize.unserialize(activeSalesRule.rows[i].customer_group_id));
                    if (skuAsal[0] == 'All') {
                        if (activeSalesRule.rows[i].sku_promo && activeSalesRule.rows[i].qty_asal) {
                            if (skuPromo) {
                                if (skuAsal.includes(barang_id)) {
                                    for (var j = 0; j < skuPromo.length; j++) {
                                        if (jumlah >= qtyAsal[j]) {
                                            let barangPromo = await sails.sendNativeQuery(`
                                                SELECT id
                                                FROM barang
                                                WHERE sku = $1 AND active = 1
                                            `, [skuPromo]);

                                            discount[barang_id] = 0
                                            if (barangPromo.rows.length > 0) {
                                                barangPromoTemp[barangPromo.rows[0].id] = barangPromo.rows[0].sku;
                                                qtyPromoTemp[barangPromo.rows[0].id] = Math.floor(jumlah / qtyasal[j]);
                                                discount[barang_id] += activeSalesRule.rows[i].discount_amount;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        if (salesRuleBarang) {
                            if (salesRuleBarang.includes(barang_id)) {
                                var countSkuPromo = skuPromo.length;
                                var countSkuAsal = skuAsal.length;

                                if (skuPromo) {
                                    for (var j = 0; j < skuPromo.length; j++) {
                                        if (countSkuPromo > countSkuAsal) {
                                            j -= 1;
                                        }

                                        if (jumlah >= qtyAsal[j]) {
                                            discount[barang_id] = 0;
                                            let barangPromo = await sails.sendNativeQuery(`
                                                SELECT id
                                                FROM barang
                                                WHERE sku = $1 AND active = $2
                                            `, [skuPromo[j], 1]);
                                            if (barangPromo.rows.length > 0) {
                                                barangPromoTemp[barangPromo.rows[0].id] = barangPromo.rows[0].sku;
                                                if (skuAsal.includes(barang_id)) {
                                                    qtyPromoTemp[barangPromo.rows[0].id] = Math.floor(jumlah / qtyAsal[j]);
                                                } else {
                                                    qtyPromoTemp[barangPromo.rows[0].id] = qtyPromo[j];
                                                }
                                                discount[barang_id] += activeSalesRule.rows[i].discount_amount;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    promo[barang_id] = {
                        'name': activeSalesRule.rows[i].name,
                        'productDiscounts': discount,
                        'productPromos': custGroup.includes(customerGroupId) ? barangPromoTemp : null
                    };
                }
            }

            let qCekStokBarang = await sails.sendNativeQuery(`
                SELECT sl.stock as stock_total
                FROM barang b
                LEFT JOIN stock_locations sl ON b.id = sl.barang_id
                LEFT JOIN locations l ON sl.location_id = l.id
                WHERE b.id = $1 AND
                    l.store_id = $2 AND
                    l.location_no = $3
            `, [barang_id, storeId, 4]);

            if (promo.length > 0) {
                let result = {
                    'detail_promo': promo,
                    'qty_promos': qtyPromoTemp,
                    'price_after_disc': potongan,
                    'stock_alert': jumlah > qCekStokBarang.rows[0].stock_total ? 'stock tidak cukup' : 'stock cukup',
                    'uses_per_customer': activeSalesRule.rows.length > 0 ? activeSalesRule.rows[0].uses_per_customer : 9999
                };

                return sails.helpers.convertResult(1, '', result, this.res);
            }
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };