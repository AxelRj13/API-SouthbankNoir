const jwToken = require("../../services/jwToken");
const bcrypt = require('bcrypt');

module.exports = {
    friendlyName: 'Register',
    inputs: {
      email: {
        description: 'The email to try in this attempt, e.g. "irl@example.com".',
        type: 'string'
      },
      phone: {
        type: 'string'
      },
      first_name: {
        type: 'string',
        required: true
      },
      last_name: {
        type: 'string'
      },
      date_of_birth: {
        type: 'string'
      },
      city: {
        type: 'string'
      },
      password: {
        type: 'string',
        required: true
      },
      confirm_password: {
        type: 'string',
        required: true
      }
    },
    exits: {
      success: {
        description: 'The requesting user agent has been successfully registered.'
      },
      badCombo: {
        description: `The password does not match`,
        responseType: 'notMatch'
      }
    },
  
    fn: async function ({email, phone, first_name, last_name, date_of_birth, city, password, confirm_password}) {
      // check existing user
      if (email) {
        var userRecord = await Member.findOne({
          select: ['id', 'email', 'phone', 'first_name', 'last_name', 'password'],
          where: { email: email.toLowerCase() }
        });
      } else {
        var userRecord = await Member.findOne({
          select: ['id', 'email', 'phone', 'first_name', 'last_name', 'password'],
          where: { phone: phone }
        });
      }
  
      if (userRecord) {
        return sails.helpers.convertResult(0, 'Email / Phone is already exist, please try with another.', null, null);
        // return this.res.status(400).send('Email is already exist, please try with another email.');
      } else {
        if (password !== confirm_password) {
          return sails.helpers.convertResult(0, 'Password doesn\'t match.', null, null);
          // return this.res.status(400).send('Password doesn\'t match.');
        } else {
            const newMember = await Member.create({
              first_name: first_name,
              last_name: last_name,
              phone: phone,
              email: email,
              date_of_birth: date_of_birth,
              city: city.toUpperCase(),
              photo: 'profile/noprofileimage.png',
              status: 1,
              password: bcrypt.hashSync(password, 10),
              created_by: 1,
              updated_by: 1,
              created_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}),
              updated_at: new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"})
            }).fetch();
            
            sails.log("successfully created: "+newMember.id);
            this.req.session.userId = newMember.id;
    
            var jwTokenSign = jwToken.sign(newMember, this.req.headers['x-secret-token']);
            let data = {
              id: jwTokenSign.user.data.id,
              email: jwTokenSign.user.data.email ? jwTokenSign.user.data.email : '',
              first_name: jwTokenSign.user.data.first_name,
              last_name: jwTokenSign.user.data.last_name,
              phone: jwTokenSign.user.data.phone,
              city: jwTokenSign.user.data.city,
              date_of_birth: await sails.helpers.convertDate(jwTokenSign.user.data.date_of_birth),
              photo: sails.config.sailsImagePath + jwTokenSign.user.data.photo
            }
            return sails.helpers.convertResult(jwTokenSign.status, jwTokenSign.message, data, jwTokenSign);
        }
      }
    }
  };
  