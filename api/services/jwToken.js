/**
 * Service to generate JWT
 */
var jwt = require('jsonwebtoken');

module.exports = {
	'sign': function(payload, secret) {
		if (secret) {
			if (secret !== sails.config.secret) {
				return {
					status: 0,
					message: "Secret token doesn't match"
				}
			}
			return {
				status: 1,
				message: 'OK',
				token: jwt.sign({data: payload}, sails.config.secret, {expiresIn: sails.config.tokenExpired}),
				user: {
					data: payload
				}
			};
		} else {
			return {
				status: 0,
				message: "Secret token doesn't exist"
			}
		}
	},
	'verify': function(token, callback) {
		jwt.verify(token, sails.config.secret, callback);
	}
};