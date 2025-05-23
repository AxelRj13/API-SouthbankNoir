const jwToken = require("../../services/jwToken");

module.exports = {
    friendlyName: 'Login',
    description: 'Log in using the provided email and password combination.',
    inputs: {
      email: {
        description: 'Fill with email or phone number of registered user',
        type: 'string',
        required: true
      },
      password: {
        description: 'The unencrypted password to try in this attempt, e.g. "passwordlol".',
        type: 'string',
        required: false
      },
      is_via_google: {
        description: 'To flag whether it is from google or not',
        type: 'boolean',
        required: false
      },
      rememberMe: {
        description: 'Whether to extend the lifetime of the user\'s session.',
        extendedDescription:
  `Note that this is NOT SUPPORTED when using virtual requests (e.g. sending
  requests over WebSockets instead of HTTP).`,
        type: 'boolean',
        default: false
      }
    },
  
    exits: {
      success: {
        description: 'The requesting user agent has been successfully logged in.',
        extendedDescription:
  `Under the covers, this stores the id of the logged-in user in the session
  as the \`userId\` key.  The next time this user agent sends a request, assuming
  it includes a cookie (like a web browser), Sails will automatically make this
  user id available as req.session.userId in the corresponding action.  (Also note
  that, thanks to the included "custom" hook, when a relevant request is received
  from a logged-in user, that user's entire record from the database will be fetched
  and exposed as \`req.me\`.)`
      },
      badCombo: {
        description: `The email/password is incorrect.`,
        responseType: 'unauthorized'
        // ^This uses the custom `unauthorized` response located in `api/responses/unauthorized.js`.
        // To customize the generic "unauthorized" response across this entire app, change that file
        // (see api/responses/unauthorized).
        //
        // To customize the response for _only this_ action, replace `responseType` with
        // something else.  For example, you might set `statusCode: 498` and change the
        // implementation below accordingly (see http://sailsjs.com/docs/concepts/controllers).
      }
    },
  
    fn: async function ({email, password, rememberMe, is_via_google}) {
  
      // Look up by the email address.
      // (note that we lowercase it to ensure the lookup is always case-insensitive,
      // regardless of which database we're using)
      var userRecord = await Member.findOne({
        select: ['id', 'email', 'first_name', 'last_name', 'password', 'photo', 'phone', 'gender', 'city', 'date_of_birth'],
        where: {
          status: 1,
          or: [
            { email: email.toLowerCase() },
            { phone: email }
          ]
        }
      });
  
      // If there was no matching user, respond thru the "badCombo" exit.
      if (!userRecord) {
        return sails.helpers.convertResult(0, 'User is not exist / not active anymore', null, null);
        // return this.res.status(401).send('User is not exist / not active anymore');
      }
  
      // if login via google, no need to check password
      if (!is_via_google) {
        // If the password doesn't match, then also exit thru "badCombo".
        if (!password) {
          return sails.helpers.convertResult(0, 'Password cannot be empty', null, null);
        }
        await sails.helpers.passwords
          .checkPassword(password, userRecord.password)
          .intercept('incorrect', 'badCombo');
      }
  
      // If "Remember Me" was enabled, then keep the session alive for
      // a longer amount of time.  (This causes an updated "Set Cookie"
      // response header to be sent as the result of this request -- thus
      // we must be dealing with a traditional HTTP request in order for
      // this to work.)
      if (rememberMe) {
        if (this.req.isSocket) {
          sails.log.warn(
            'Received `rememberMe: true` from a virtual request, but it was ignored\n'+
            'because a browser\'s session cookie cannot be reset over sockets.\n'+
            'Please use a traditional HTTP request instead.'
          );
        } else {
          this.req.session.cookie.maxAge = sails.config.custom.rememberMeCookieMaxAge;
        }
      }
  
      // Modify the active session instance.
      // (This will be persisted when the response is sent.)
      this.req.session.userId = userRecord.id;
  
      // In case there was an existing session (e.g. if we allow users to go to the login page
      // when they're already logged in), broadcast a message that we can display in other open tabs.
      if (sails.hooks.sockets) {
        await sails.helpers.broadcastSessionChange(this.req);
      }

      var jwTokenSign = jwToken.sign(userRecord, this.req.headers['x-secret-token']);
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
  };
  