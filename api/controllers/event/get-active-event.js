module.exports = {
    friendlyName: 'Get list of active events',
    inputs: {
        keyword: {
          type: 'string',
          required: false
        }
    },
    fn: async function ({keyword}) {
        var query = `
            SELECT e.id, 
                e.name, 
                e.artist, 
                s.name as store_name, 
                $2 || e.image as image, 
                to_char(start_date, 'Dy, DD Mon YYYY') as date_start, 
                to_char(start_date, 'HH24:MI') as time_start
            FROM events e 
            JOIN stores s ON e.store_id = s.id
            WHERE e.status = $1 AND 
                s.status = $1 AND 
                date(e.end_date) >= $3
        `;

        if (keyword) {
            query += ` AND (
                (' '||e.name||' ' ILIKE '% `+keyword+` %' OR replace(e.name, ' ', '') ILIKE '%'||replace('`+keyword+`', ' ', '')||'%') OR 
                (' '||e.artist||' ' ILIKE '% `+keyword+` %' OR replace(e.artist, ' ', '') ILIKE '%'||replace('`+keyword+`', ' ', '')||'%') OR
                (' '||s.name||' ' ILIKE '% `+keyword+` %' OR replace(s.name, ' ', '') ILIKE '%'||replace('`+keyword+`', ' ', '')||'%')
            )`;
        }

        let result = await sails.sendNativeQuery(query + ` ORDER BY start_date`, [1, sails.config.imagePath, new Date()]);

        if (result.rows.length > 0) {
            return sails.helpers.convertResult(1, '', result.rows, this.res);
        } else {
            return sails.helpers.convertResult(0, 'Not Found');
        }
    }
  };