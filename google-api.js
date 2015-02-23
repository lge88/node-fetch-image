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

function siteLinkStream(urlStream) {
  return fetch(urlStream)
    .parallel(10)
    .invoke('toString')
    .through(htmlParser)
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
  return links.filter(function(x) { return x !== null; });
}

var req = require('request');
function imageLinkStream(urlStream, keyword) {
  return fetch(urlStream)
  // TODO: make it pretty
    .map(function(s) {
      return s.invoke('toString')
        .through(htmlParser)
        .map(extractImageLinks(keyword));
    })
    .parallel(10)
    .flatten();
}
exports.imageLinkStream = imageLinkStream;

function extractImageLinks(keyword) {
  return function(window) {
    var document = window.document;
    var imgs = document.querySelectorAll('img');
    imgs = Array.prototype.filter.call(imgs, function(img) {
      return fuzzyMatch(img.alt, keyword) ||
        fuzzyMatch(img.title, keyword) ||
        fuzzyMatch(img.src, keyword);
    });

    var links =  imgs.map(function(img) {
      return img.src.replace(/file:\/+/, 'http://');
    }).filter(function(x) { return !!x; });
    return links;
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

if (!module.parent) {
  var keyword = 'ellie goulding';
  var searchUrlStream = imageSearchUrlStream(keyword, 33);
  var siteUrlStream = siteLinkStream(searchUrlStream);

  // var u = 'http://en.wikipedia.org/wiki/Ellie_Goulding';
  // siteUrlStream.toArray(function(arr) {
  //   console.log("arr = ", arr);
  //   var imageUrlStream = imageLinkStream(arr, keyword)
  //         .errors(noop)
  //         .each(_.log);
  // });

  var noop = function() {};

  var imageUrlStream = imageLinkStream(siteUrlStream, keyword)
        .errors(noop)
        .take(100)
        .each(_.log);

  // searchUrlStream.observe().append('').tap(_.log);
  // siteUrlStream.observe().append('').tap(_.log);
  // siteUrlStream.observe().tap(_.log);
  // searchUrlStream
  //   .concat([''])
  //   .concat(siteLinkStream)
  //   // .concat([''])
  //   // .concat(imageUrlStream)
  //   .each(_.log);

  // siteUrlStream.each(_.log);
  // imageUrlStream
    // .errors(noop)
    // .each(_.log);

}
