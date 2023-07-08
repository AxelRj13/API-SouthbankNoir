module.exports = {
    friendlyName: 'Get Membership based on user logged in',
    fn: async function () {
      let memberId = this.req.headers.member_id;
      let currentMembership = await sails.sendNativeQuery(`
        SELECT um.points, um.total_spent, mt.name, mt.total_spent_max, (mt.total_spent_max - um.total_spent) as diff_next_tier
        FROM user_memberships um
        JOIN membership_tiers mt ON um.membership_tier_id = mt.id
        WHERE um.member_id = $1 AND um.status = $2 AND mt.status = $2
      `, [memberId, 1]);

      var result = currentMembership.rows;
      if (currentMembership.rows.length <= 0) {
        // default tier
        let basicMembership = await sails.sendNativeQuery(`
          SELECT mt.name, mt.total_spent_max
          FROM membership_tiers mt
          WHERE lower(mt.name) = $1 AND mt.status = $2
        `, ['basic', 1]);

        result = {
          points: 0,
          total_spent: 0,
          name: basicMembership.rows[0].name,
          total_spent_max: basicMembership.rows[0].total_spent_max,
          diff_next_tier: 'Rp. ' + await sails.helpers.numberFormat(basicMembership.rows[0].total_spent_max) + ' left to reach VIP'
        };
      } else {
        let nextTier = await sails.sendNativeQuery(`
          SELECT mt.name
          FROM membership_tiers mt
          WHERE mt.status = $1 AND (mt.total_spent_min - $2) = 1;
        `, [1, result[0].total_spent_max]);

        result[0].diff_next_tier = 'Rp. ' + await sails.helpers.numberFormat(result[0].total_spent_max - result[0].total_spent) + ' left to reach ' + nextTier.rows[0].name;
      }

      return sails.helpers.convertResult(1, '', result, this.res);
    }
  };
  