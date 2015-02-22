var _ = require('highland');
var req = require('request');
function parRequest(urlIterator, transformEach, N) {
  if (typeof transformEach !== 'function')
    transformEach = function(x) { return x; };

  N = parseInt(N);
  if (isNaN(N)) N = 10;

  function makeReq(url) {
    return _(req(url)).through(transformEach);
  }

  return _(function(push, next) {
    if (urlIterator.hasNext()) {
      push(null, makeReq(urlIterator.next()));
      next();
    } else {
      push(null, _.nil);
    }
  }).parallel(N);

}

module.exports = exports = parRequest;
