module.exports = {
    friendlyName: 'Convert date to UTC+7',
    inputs: {
      date: {
        type: 'string',
        required: true
      }
    },
    exits: {
      success: {
        description: 'All done.',
      }
    },
  
    fn: async function ({ date }) {
        let formattedDate = new Date(date);
        formattedDate.setTime(formattedDate.getTime() + 7 * 60 * 60 * 1000);
        return formattedDate.toJSON().slice(0, 10);
    }
  };
  
  