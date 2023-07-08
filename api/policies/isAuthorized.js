const sailsHookApianalytics = require("sails-hook-apianalytics");
const jwToken = require("../services/jwToken");

module.exports = async function(req, res, next) {
	var token;
	//Check if authorization header is present
	if(req.headers && req.headers.authorization) {
		//authorization header is present
		var parts = req.headers.authorization.split(' ');
		if(parts.length == 2) {
			var scheme = parts[0];
			var credentials = parts[1];
			
			if(/^Bearer$/i.test(scheme)) {
				token = credentials;
			}
		} else {
			return res.status(401).json({err: 'Format is Authorization: Bearer [token]'});
		}
	} else {
		//authorization header is not present
		return res.status(401).json({err: 'No Authorization header was found'});
	}

	var userRecord = await Member.findOne({
		select: ['id', 'email', 'first_name', 'last_name', 'password', 'photo'],
		where: {id: req.headers.member_id, status: 1}
	});

	jwToken.verify(token, function(err, decoded) {
		var returnedToken = token;
		var decodedToken = decoded;
		if (err) {
			if (req.headers['is_mobile'] && err.expiredAt < new Date().getTime()) {
				// refresh token if expired
				returnedToken = jwToken.sign(userRecord, req.headers['x-secret-token']);
				jwToken.verify(returnedToken.token, function(err, decoded) {
					if (!err) {
						decodedToken = decoded;
						returnedToken = returnedToken.token;
					} else {
						sails.log(err);
					}
				});
			} else {
				return res.status(401).json({err: err.message});
			}
		}
		res.user = decodedToken;
		res.token = returnedToken;
		next();
	});
};