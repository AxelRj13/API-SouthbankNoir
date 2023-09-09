module.exports = {
    friendlyName: 'Check inputted email',
    inputs: {
        email: {
          type: 'string',
          required: true
        }
    },
    fn: async function ({email}) {
        let result = await sails.sendNativeQuery(`
            SELECT id, email
            FROM members
            WHERE email = $1
            LIMIT 1
        `, [email]);

        return sails.helpers.convertResult(1, '', {alreadyRegistered: result.rows.length > 0}, this.res);
    }
  };
  