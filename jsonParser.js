
function jsonParser(s) {
  return s.collect()
    .map(function(bufs) {
      var data = Buffer.concat(bufs);
      return JSON.parse(data.toString());
    })
    .errors(function(err, push) {
      push(null, { err: err });
    });
}

module.exports = exports = jsonParser;
