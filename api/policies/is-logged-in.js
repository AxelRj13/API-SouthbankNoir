/**
 * is-logged-in
 *
 * A simple policy that allows any request from an authenticated user.
 *
 * For more about how to use policies, see:
 *   https://sailsjs.com/config/policies
 *   https://sailsjs.com/docs/concepts/policies
 *   https://sailsjs.com/docs/concepts/policies/access-control-and-permissions
 */
module.exports = async function (req, res, proceed) {

  // If `req.me` is set, then we know that this request originated
  // from a logged-in user.  So we can safely proceed to the next policy--
  // or, if this is the last policy, the relevant action.
  // > For more about where `req.me` comes from, check out this app's
  // > custom hook (`api/hooks/custom/index.js`).
  if (req.me) {
    return proceed();
  }

  // get token from header an validate it
  var token = req.headers["x-token"];

  // validate we have all params
  if (!token) {
    return res.unauthorized();
  }

  // validate token and set req.User if we have a valid token
  sails.services.tokenauth.verifyToken(token, function(err, data) {
    if (err) {
      return res.unauthorized();
    }

    sails.models.user.findOne({id: data.userId}, function(err, User) {
      if (err) {
        return res.unauthorized();
      }
      req.User = User;
      next();
    });
  });

  // Otherwise, this request did not come from a logged-in user.
  return res.unauthorized();

};
