module.exports = {
    friendlyName: 'Get active contact number for redirect to whatsapp',
    fn: async function () {
        let result = await sails.sendNativeQuery(`
            SELECT value
            FROM configurations
            WHERE name = $1 AND status = $2
        `, ['contact_us', 1]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', 'https://api.whatsapp.com/send/?phone='+result.rows[0].value+'&text&type=phone_number&app_absent=0', this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };