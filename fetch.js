var _ = require('highland');
var req = require('request');

// Input a stream of url strings
// Output a stream of byte streams that fetched from the url.
function fetch(urls) { return _(urls).map(urlToBytes); };
function urlToBytes(url) { return _(req(url)); }

if (!module.parent) {
  var urls = [
    'http://lige.me/phonecode/phone.txt',
    'http://lige.me/phonecode/phone.txt',
    'http://lige.me/phonecode/phone.txt'
  ];

  var seq = fetch(urls)
        .sequence()
        .invoke('toString');

  var par = fetch(urls)
        .parallel(10)
        .invoke('toString');

  _(['seq:'])
    .concat(seq)
    .concat(['par:'])
    .concat(par)
    .each(_.log);
}

module.exports = exports = fetch;
