// https://www.google.com/search?q=ellie+goulding&start=100&tbm=isch
var querystring = require('querystring');
var _ = require('highland');
var assign = require('object-assign');
var fetch = require('./fetch');
var htmlParser = require('./htmlParser');

var ENDPOINT = 'https://www.google.com/search?';
var RESULT_PER_PAGE = 20;
var DEFAULT_PARAMS = {
  tbm: 'isch',
  num: RESULT_PER_PAGE,
  start: 0
};

// Input a search keyword and num of results.
// Output a stream of url streams.
function imageSearchUrlStream(keyword, num) {
  var baseParams = assign({}, DEFAULT_PARAMS, { q: '' + keyword });

  num = parseInt(num);
  if (isNaN(num) || num < 0) num = 100;

  var count = 0;
  return _(function(push, next) {
    if (count < num) {
      var params = assign({}, baseParams, {
        start: count
      });

      count += RESULT_PER_PAGE;
      if (count > num)
        params.num = num - (count - RESULT_PER_PAGE);

      push(null, ENDPOINT + querystring.stringify(params));
      next();
    } else {
      push(null, _.nil);
    }
  });
}
exports.imageSearchUrlStream = imageSearchUrlStream;

function parseHTML(s) {
  return s.invoke('toString').through(htmlParser);
}

function siteLinkStream(urlStream) {
  return fetch(urlStream)
    .map(parseHTML)
    .parallel(10)
    .map(extractSiteLinks)
    .flatten();
}
exports.siteLinkStream = siteLinkStream;

function extractSiteLinks(window) {
  var document = window.document;
  var aElements = document.querySelectorAll('table.images_table>tbody>tr>td>a');
  var links = Array.prototype.map.call(aElements, function(a) {
    var href = a.href;
    var m = href.match(/^.*url\?q=([^&]*)/);
    if (m) return m[1];
    return null;
  });
  return _(links).filter(function(x) { return x !== null; });
}

function imageLinkStream(urlStream, keyword) {
  return fetch(urlStream)
    .map(parseHTML)
    .map(function(s) {
      return s.map(extramImageInfo(keyword));
    })
    .parallel(10)
    .flatten();
}
exports.imageLinkStream = imageLinkStream;

function extramImageInfo(keyword) {
  return function(window) {
    var document = window.document;
    return _(Array.prototype.filter.call(
      document.querySelectorAll('img'),
      function(img) {
        return fuzzyMatch(img.alt, keyword) ||
          fuzzyMatch(img.title, keyword) ||
          fuzzyMatch(img.src, keyword);
      }))
      .filter(function(img) { return !!(img.src); })
      .map(function(img) {
        var url = img.src.replace(/file:\/+/, 'http://');
        return url;
        // return { url: url };
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

function downloadImageStream(dest) {
  return function(imageInfoStream) {

  };
}

if (!module.parent) {
  var noop = function() {};
  var keyword = 'ellie goulding';
  var searchUrlStream = imageSearchUrlStream(keyword, 33);
  var siteUrlStream = siteLinkStream(searchUrlStream);
  var imageUrlStream = imageLinkStream(siteUrlStream, keyword)
        .errors(noop)
        .take(100)
        .each(_.log);
}
