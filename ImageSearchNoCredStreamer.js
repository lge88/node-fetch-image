// Parse the DOM hack!!!
var _ = require('highland');
var querystring = require('querystring');
var assign = require('object-assign');
var lazyRequest = require('./lazyRequest');
var parRequest = require('./parRequest');
var htmlParser = require('./htmlParser');

// https://www.google.com/search?q=ellie+goulding&start=80&sa=N&tbm=isch&gbv=1&sei=VknqVL3sGJbqoATOhoLgDg
var ENDPOINT = 'https://www.google.com/search?';
var RESULT_PER_PAGE = 20;
var DEFAULT_PARAMS = {
  tbm: 'isch',
  num: RESULT_PER_PAGE,
  start: 0
};
// https://www.google.com/search?q=ellie+goulding&start=100&tbm=isch

// keyword is the search keyword
// num is the number of results, default is 100;
// Return a highland Stream of window objects.
function getHTMLStreams(keyword, aNum) {
  // TODO: handle num
  var baseParams = assign({}, DEFAULT_PARAMS, { q: '' + keyword });
  var num = parseInt(aNum);
  if (isNaN(num) || num < 0) num = 100;

  function makeUrlIterator(num) {
    var count = 0;
    return {
      hasNext: function() { return count < num; },
      next: function() {
        var params = assign({}, baseParams, {
          start: count
        });

        count += RESULT_PER_PAGE;
        if (count > num)
          params.num = num - (count - RESULT_PER_PAGE);

        return ENDPOINT + querystring.stringify(params);
      }
    };
  }

  var iter = makeUrlIterator(num);

  return parRequest(iter, function(s) {
    return s.invoke('toString');
  });
}

function extractWebsiteLinks(window) {
  var document = window.document;
  var aElements = document.querySelectorAll('table.images_table>tbody>tr>td>a');
  var links = Array.prototype.map.call(aElements, function(a) {
    var href = a.href;
    var m = href.match(/^.*url\?q=([^&]*)/);
    if (m) return m[1];
    return null;
  });
  return links.filter(function(x) { return x !== null; });
}

var req = require('request');
function scrapeWebsiteForImageLinks(keyword) {
  return function(websiteUrl) {
    return _(req(websiteUrl))
      .invoke('toString')
      .through(htmlParser)
      .map(function(window) {
        var document = window.document;
        var imgs = document.querySelectorAll('img');
        imgs = Array.prototype.filter.call(imgs, function(img) {
          return fuzzyMatch(img.alt, keyword) ||
            fuzzyMatch(img.title, keyword) ||
            fuzzyMatch(img.src, keyword);
        });
        return imgs.map(function(img) {
          return img.src.replace(/file:\/+/, 'http://');
        });
      });
  };
}
// TODO: integrate http://glench.github.io/fuzzyset.js/ maybe?
function fuzzyMatch(inputStr, keyword) {
  var words = keyword.split(' ');
  return words.some(function(word) {
    var p = new RegExp(word, 'i');
    return p.test(inputStr);
  });
}

function iterToStream(iter) {
  return _(function(push, next) {
    if(iter.hasNext()) {
      push(null, iter.next());
      next();
    } else {
      push(null, _.nil);
    }
  });
};

if (!module.parent) {

  getHTMLStreams('ellie goulding', 200)
    // .head()
    // .flatten()
    .through(htmlParser)
    .map(extractWebsiteLinks)
    .flatten()
    .map(scrapeWebsiteForImageLinks('ellie goulding'))
  // FIXME: parallel will cause error at the end.
  // .parallel(10)
    .flatten()
    .each(_.log);
}
