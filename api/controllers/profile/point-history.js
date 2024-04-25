module.exports = {
    friendlyName: 'Get profile point history',
    fn: async function () {
        var result = [];
        let memberId = this.req.headers['member-id'];
        let histories = await sails.sendNativeQuery(`
            SELECT ph.title, ph.type, ph.amount, ph.latest_point, ph.nominal, b.order_no, t.name as "table_name", t.table_no, to_char(ph.created_at, 'DD Mon YYYY HH24:MI:SS') as "created_date"
            FROM point_history_logs ph
            LEFT JOIN booking_details bd ON ph.booking_details_id = bd.id
            LEFT JOIN bookings b ON bd.booking_id = b.id
            LEFT JOIN tables t ON bd.table_id = t.id
            WHERE ph.member_id = $1
            ORDER BY ph.created_at DESC
        `, [memberId]);

        if (histories.rows.length > 0) {
            for (const historyData of histories.rows) {
                let titleArr = historyData.title.replace('</b>', '').split('<br><b>');
                var details = null;
                var tableInfo = null;
                if (titleArr[0].includes('BE SB')) {
                    // adjustment from BE SB
                    details = historyData.order_no;
                    tableInfo = historyData.table_name + ' - ' + historyData.table_no + ' | Rp. ' + await sails.helpers.numberFormat(historyData.nominal);
                } else if (titleArr[0].includes('Mobile')) {
                    // order from apps
                    details = 'Rp. ' + await sails.helpers.numberFormat(historyData.nominal);
                }
                result.push({
                    title: titleArr[0],
                    details: details,
                    table_info: tableInfo,
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