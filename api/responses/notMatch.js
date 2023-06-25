module.exports = function notFound() {
    var res = this.res;
    return res.status(400).send('The password does not match');
};