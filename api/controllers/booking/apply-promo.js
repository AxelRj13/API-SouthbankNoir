module.exports = {

    friendlyName: 'Apply promo',
    inputs: {
        subtotal: {
          type: 'number',
          required: true
        },
        store_id: {
          type: 'number',
          required: true
        },
        code: {
          type: 'string',
          required: true
        }
    },
  
    fn: async function ({subtotal, store_id, code}) {
        let memberId = this.req.headers['member-id'];

        if (subtotal > 0) {
            // promo code validation
            let promoValue = 0;
            let promoType;
            let promos = await sails.sendNativeQuery(`
                SELECT p.id, p.value, p.type, p.max_use_per_member, p.minimum_spend
                FROM promos p
                JOIN promo_stores ps ON ps.promo_id = p.id
                WHERE UPPER(p.code) = $1 AND
                    p.status = $2 AND
                    ps.store_id = $3 AND
                    $4 BETWEEN p.start_date AND p.end_date
            `, [code.toUpperCase(), 1, store_id, new Date()]);

            if (promos.rows.length > 0) {
                let promoUsage = await sails.sendNativeQuery(`
                    SELECT id
                    FROM promo_usage_members
                    WHERE promo_id = $1 AND member_id = $2
                `, [promos.rows[0].id, memberId]);

                // check maximum usage
                if (promos.rows[0].max_use_per_member <= promoUsage.rows.length) {
                    return sails.helpers.convertResult(0, 'Promo code has reached maximum usage.', null, this.res);
                }

                // check minimum spend
                if (subtotal < promos.rows[0].minimum_spend) {
                    let diff = promos.rows[0].minimum_spend - subtotal;
                    return sails.helpers.convertResult(0, 'You need to spend Rp. ' + await sails.helpers.numberFormat(parseInt(diff)) + ' more to apply this promo.', null, this.res);
                }

                promoValue = promos.rows[0].value;
                promoType = promos.rows[0].type;
            } else {
                let coupons = await sails.sendNativeQuery(`
                    SELECT c.value, c.type
                    FROM coupon_members cm
                    JOIN coupons c ON cm.coupon_id = c.id
                    WHERE cm.member_id = $1 AND
                        cm.status = $2 AND
                        c.status = $2 AND
                        c.start_date <= $3 AND
                        c.validity_date >= $3 AND
                        UPPER(cm.code) = $4 AND 
                        cm.usage = $5
                `, [memberId, 1, new Date(), code.toUpperCase(), 0]);

                if (coupons.rows.length > 0) {
                    promoValue = coupons.rows[0].value;
                    promoType = coupons.rows[0].type;
                } else {
                    return sails.helpers.convertResult(0, 'Promo / Coupon code not valid or has reached maximum usage.', null, this.res);
                }
            }

            // convert if type is percentage
            let discount = promoValue;
            if (promoType == 'percentage') {
                discount = (promoValue/100) * subtotal;
            }

            let totalPayment = parseInt(subtotal) - parseInt(discount);
            let result = {
                discount: 'Rp. ' + await sails.helpers.numberFormat(parseInt(discount)),
                payment: 'Rp. ' + await sails.helpers.numberFormat(parseInt(totalPayment)),
            };

            return sails.helpers.convertResult(1, 'Promo/Coupon Applied', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Amount not valid', null, this.res);
        }
    }
  };