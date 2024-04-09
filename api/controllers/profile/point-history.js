module.exports = {
    friendlyName: 'Get profile point history',
    fn: async function () {
        var result = [];
        let memberId = this.req.headers['member-id'];
        let histories = await sails.sendNativeQuery(`
            SELECT ph.title, ph.type, ph.amount, ph.latest_point, to_char(ph.created_at, 'DD Mon YYYY HH24:MI:SS') as "created_date"
            FROM point_history_logs ph
            WHERE ph.member_id = $1
            ORDER BY ph.created_at DESC
        `, [memberId]);

        if (histories.rows.length > 0) {
            for (const historyData of histories.rows) {
                let titleArr = historyData.title.replace('</b>', '').split('<br><b>');
                let detailsArr = (titleArr[1] ? titleArr[1].split('<br>') : '');
                result.push({
                    title: titleArr[0],
                    details: (detailsArr == '' ? null : detailsArr[0] + (detailsArr[1] ? detailsArr[1] : '')),
                    point_change: (historyData.type == 'increment' ? '+ ' : '- ') + await sails.helpers.numberFormat(historyData.amount),
                    latest_point: await sails.helpers.numberFormat(historyData.latest_point),
                    created_date: historyData.created_date
                });
            }
            return sails.helpers.convertResult(1, '', result, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Booking not Found', null, this.res);
        }
    }
  };