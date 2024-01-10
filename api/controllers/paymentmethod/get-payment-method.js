module.exports = {
    friendlyName: 'Get Active Payment Method',
    fn: async function () {
      let paymentMethods = await sails.sendNativeQuery(`
        SELECT pm.id, pm.name, pm.payment_type
        FROM payment_methods pm
        WHERE pm.status = $1
      `, [1]);

      let result = [];
      if (paymentMethods.rows.length > 0) {
        let bankTransfer = {
            category: "Bank Transfer (Virtual Account)",
            methods: paymentMethods.rows.filter((x) => x.payment_type == 'bank_transfer' || x.payment_type == 'echannel')
        };

        let ewallet = {
            category: "E-Wallet",
            methods: paymentMethods.rows.filter((x) => x.payment_type == 'gopay' || x.payment_type == 'shopeepay')
        };

        let creditCard = {
            category: "Credit Card",
            methods: paymentMethods.rows.filter((x) => x.payment_type == 'credit_card')
        }

        result.push(bankTransfer);
        result.push(ewallet);
        result.push(creditCard);
        return sails.helpers.convertResult(1, '', result, this.res);
      } else {
        return sails.helpers.convertResult(0, 'Not Found', null, this.res);
      }
    }
  };
  