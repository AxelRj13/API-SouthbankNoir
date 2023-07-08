module.exports = {
    friendlyName: 'Convert number to currency format',
    inputs: {
      number: {
        type: 'number',
        required: true
      }
    },
    exits: {
      success: {
        description: 'All done.',
      }
    },
  
    fn: async function ({ number }) {
        // remove sign if negative
        var sign = 1;
        if (number < 0) {
            sign = -1;
            number = -number;
        }

        // trim the number decimal point if it exists
        let num = number.toString().includes('.') ? number.toString().split('.')[0] : number.toString();

        while (/(\d+)(\d{3})/.test(num.toString())) {
            // insert comma to 4th last position to the match number
            num = num.toString().replace(/(\d+)(\d{3})/, '$1' + '.' + '$2');
        }

        // add number after decimal point
        if (number.toString().includes('.')) {
            num = num + '.' + number.toString().split('.')[1];
        }

        // return result with - sign if negative
        return sign < 0 ? '-' + num : num;
    }
  };
  
  