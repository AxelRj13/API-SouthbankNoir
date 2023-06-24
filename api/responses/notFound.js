module.exports = function notFound() {
    var res = this.res;
    sails.log.verbose('Ran custom response: res.notFound()');
    return res.status(404).send('No record found');
};