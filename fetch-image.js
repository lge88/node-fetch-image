var querystring = require('querystring');
var _ = require('highland');
var req = require('request');
var assign = require('object-assign');
var htmlParser = require('./htmlParser');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var url = require('url');

// https://www.google.com/search?q=ellie+goulding&start=100&num=20&tbm=isch
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
  var bytes = fetch(urlStream);
  // var urlCopy = urlStream.observe();
  // bytes.zip(urlCopy)
  //   .map(function(tuple) {

  //   });

  return bytes
    .map(parseHTML)
    .map(function(s) { return s.map(extramImageInfo(keyword)); })
    .parallel(10)
    .flatten();
}
exports.imageLinkStream = imageLinkStream;

function resolveUrl(from, to) {
  return url.resolve(from, to);
}

var RE_IMAGE_URL = /(\.jpeg|\.png|\.jpg)$/;
function isImageUrl(url) {
  return RE_IMAGE_URL.test(url);
}

var RE_MISSING_IMAGE_URL = /missing-image/;
function isNotMissing(url) {
  return !RE_MISSING_IMAGE_URL.test(url);
}

function extramImageInfo(keyword) {
  return function(window) {
    var document = window.document;

    return _(Array.prototype.slice.call(document.querySelectorAll('img')))
      .filter(function(img) {
        return fuzzyMatch(img.alt, keyword) ||
          fuzzyMatch(img.title, keyword) ||
          fuzzyMatch(img.src, keyword);
      })
      .map(function(img) {
        var links = [ img.src ];
        // TODO: location.href is not working, need ways to pass the url info down.
        // var pageUrl = window.location.href;
        var pageUrl = '';
        // Use image element as link to full size image.
        // TODO: The search algorithm needs to be improved. bfs/dfs maybe.
        if (img.parentNode && img.parentNode.href) {
          links.push(resolveUrl(pageUrl, img.parentNode.href));
        }

        links = links
          .filter(isImageUrl)
          .filter(isNotMissing);

        var imageInfo = { img: img, links: links };
        return imageInfo;
      })
      .map(function(imageInfo) { return imageInfo.links; })
      .map(function(links) {
        return links.map(function(url) {
          return url.replace(/file:\/+/, 'http://');
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

// TODO: make this return a stream.
function downloadImagesTo(destDirectory, prefix) {
  // TODO validate destDirectory;
  var i = 0;
  return function(url) {
    var ext = path.extname(url) || '';
    var dest = path.join(destDirectory, prefix + (i++) + ext);

    mkdirp(destDirectory, function (err) {
      if (err)
        console.error(err);
      else {
        var byteStream = req(url);

        byteStream.on('response', function() {
          var to = fs.createWriteStream(dest);
          byteStream.pipe(to);
        });

        byteStream.on('error', function(err) {
          // TODO: clean up error
          // console.log("dest = ", dest);
          // console.log("err = ", err);
          byteStream.destroy();
        });

      }
    });

    return { url: url, dest: dest };
  };
}
exports.downloadImagesTo = downloadImagesTo;

function fetch(urls) { return _(urls).map(byteStreamFromUrl); }

function byteStreamFromUrl(url) { return _(req(url)); }


if (!module.parent) {
  var noop = function() {};
  var keyword = 'ellie goulding';
  var searchUrlStream = imageSearchUrlStream(keyword, 33);
  var siteUrlStream = siteLinkStream(searchUrlStream);
  var imageUrlStream = imageLinkStream(siteUrlStream, keyword)
        .errors(noop)
        .take(100);

  // imageUrlStream.each(_.log);
  imageUrlStream
    .map(downloadImagesTo('./output/ellie-images', 'ellie-goulding-'))
    .each(_.log);
}
