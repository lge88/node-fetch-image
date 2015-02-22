var _ = require('highland');
var req = require('request');

// urlIterator is an Iterator object implements hasNext() and next()
// aProcessResponse is a function that transform the stream
// can be used in Stream#through()
function lazyRequest(urlIterator, aProcessResponse) {
  var processResponse = typeof aProcessResponse === 'function' ?
        aProcessResponse : function(x) { return x; };

  function makeReq(url) {
    return _(req(url)).through(processResponse);
  }

  return _(function(push, next) {
    if (urlIterator.hasNext()) {
      push(null, makeReq(urlIterator.next()));
      next();
    } else {
      push(null, _.nil);
    }
  }).flatten();
}

module.exports = exports = lazyRequest;

if (!module.parent) {
  var phonecodeUrl = 'http://lige.me/phonecode/phone.txt';
  var urlIterator = {
    i: 0,
    hasNext: function() { return this.i < 5; },
    next: function() { this.i++; return phonecodeUrl; }
  };

  var src = lazyRequest(urlIterator, function(s) {
    return s.invoke('toString').split()
      .filter(function(line) { return line !== ''; });
  });

  function slowDown(ms) {
    return function(s) {
      return s.consume(function(err, x, push, next) {
        if (err) {
          push(err);
          next();
        } else if (x === _.nil) {
          push(null, x);
        } else {
          push(null, x);
          setTimeout(next, ms);
        }
      });
    };
  }

  src
    .through(slowDown(200))
    .each(_.log);

}
