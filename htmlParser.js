var jsdom = require('jsdom');
var _ = require('highland');

// Input stream of html string
// Output a single window object on success.
// TODO: error handling
function htmlParser(s) {
  return s.collect()
    .map(function(strs) { return strs.join(''); })
    .consume(function(err, htmlStr, push, next) {
      jsdom.env({
        html: htmlStr,
        done: function(errors, window) {
          if (errors) {
            push(errors);
            next();
          } else if (htmlStr === _.nil) {
            push(null, _.nil);
          } else {
            push(null, window);
            next();
          }
        }
      });
    });
}

if (!module.parent) {
  _(process.stdin)
    .invoke('toString')
    .through(htmlParser)
    .each(function(window) {
      var document = window.document;
      // console.log("window = ", window);
      console.log("title = ", document.title);
    });
}

module.exports = exports = htmlParser;
