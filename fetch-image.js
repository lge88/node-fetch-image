var querystring = require('querystring');
var _ = require('highland');
var req = require('request');
var jsdom = require('jsdom');
var assign = require('object-assign');
var mkdirp = require('mkdirp');
var path = require('path');
var fs = require('fs');
var url = require('url');

// HighlandStream extensions:
var HighlandStream = _().constructor;
HighlandStream.prototype.filterAsync = function (f) {
  return this.consume(function(err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === _.nil) {
      push(null, _.nil);
    } else {
      next();
      f(x, function(ok) {
        if (ok) push(null ,x);
      });
    }
  });
};

HighlandStream.prototype.drop = function (n) {
  if (n === 0) {
    return _([]);
  }
  return this.consume(function (err, x, push, next) {
    if (err) {
      push(err);
      if (n < 0) {
        next();
      }
      else {
        push(null, _.nil);
      }
    }
    else if (x === _.nil) {
      push(null, _.nil);
    }
    else {
      n--;
      if (n < 0) {
        push(null, x);
      }

      next();
    }
  });
};

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

// map a url string to a stream of window objects (parsed HTML).
function urlToWindowStream(url) {
  return _(function(push, next) {
    try {
      jsdom.env({
        url: url,
        done: function(errors, window) {
          push(errors, window);
          push(null, _.nil);
        }
      });
    } catch(err) {
      push(err);
      push(null, _.nil);
    }
  });
}
exports.urlToWindowStream = urlToWindowStream;

// TODO: make this a member of ImageFetcher instance.
exports.numParTasks = 8;

function siteLinkStream(urlStream) {
  return urlStream
    .map(urlToWindowStream)
    .parallel(exports.numParTasks)
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

  window.close();
  return _(links).filter(function(x) { return x !== null; });
}

function imageLinkStream(urlStream, keyword) {
  return urlStream
    .map(urlToWindowStream)
    .parallel(exports.numParTasks)
    .map(scrapeForImageLinks(keyword))
    .flatten();
}
exports.imageLinkStream = imageLinkStream;

var RE_IMAGE_URL = /(\.jpeg|\.png|\.jpg)$/;
function isImageUrl(url) {
  return RE_IMAGE_URL.test(url);
}

var RE_MISSING_IMAGE_URL = /missing-image/;
function isNotMissing(url) {
  return !RE_MISSING_IMAGE_URL.test(url);
}

function scrapeForImageLinks(keyword) {
  return function(window) {
    var document = window.document;

    var links = _(Array.prototype.slice.call(document.querySelectorAll('img')))
          .filter(function(img) {
            return fuzzyMatch(img.alt, keyword) ||
              fuzzyMatch(img.title, keyword) ||
              fuzzyMatch(img.src, keyword);
          })
          .map(function(img) {
            var links = [ img.src ];
            // Use image element as link to full size image.
            // TODO: It would nice if the search algorithm go some level deeper.
            if (img.parentNode && img.parentNode.href) {
              links.push(img.parentNode.href);
            }

            links = links
              .filter(isImageUrl)
              .filter(isNotMissing);

            var imageInfo = { img: img, links: links };
            return imageInfo;
          })
          .map(function(imageInfo) { return imageInfo.links; });

    window.close();
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

// TODO: make this return a stream of byte streams.
function downloadImagesTo(destDirectory, prefix) {
  // TODO validate destDirectory;
  var i = 0;
  return function(url) {
    var ext = path.extname(url) || '';
    var dest = path.join(destDirectory, prefix + (i++) + ext);

    // TODO: mkdirp should not be here, put it into bin/
    mkdirp(destDirectory, function (err) {
      if (err)
        console.error(err);
      else {
        var byteStream = req(url);

        byteStream.on('response', function(resp) {
          var statusCode = '' + resp.statusCode, to;
          if (!/^4/.test(statusCode)) {
            to = fs.createWriteStream(dest);
            byteStream.pipe(to);
          }
          byteStream.destroy();
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

var noop = function() {};
function run(config) {
  var searchUrlStream = imageSearchUrlStream(config.keyword, config.numGoogleResults);
  var siteUrlStream = siteLinkStream(searchUrlStream);
  var outputStream = imageLinkStream(siteUrlStream, config.keyword);

  // TODO: if config.verbose print the error to stderr
  outputStream = outputStream.errors(noop);

  if (config.destDirectory) {
    outputStream = outputStream
    // Side effect:
      .map(downloadImagesTo(config.destDirectory, config.prefix))
      .map(function(obj) {
        return obj.url + ' ' + obj.dest;
      });
  }

  outputStream = outputStream.take(config.numImages);
  return outputStream;
}

exports.run = run;

// http://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-an-url
function isValidUrl(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
                           '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
                           '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
                           '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
                           '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
                           '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  if(!pattern.test(str)) {
    return false;
  } else {
    return true;
  }
}
exports.isValidUrl = isValidUrl;

if (!module.parent) {
  exports.numParTasks = 8;
  var keyword = 'ellie goulding';
  var searchUrlStream = imageSearchUrlStream(keyword, 53);
  var siteUrlStream = siteLinkStream(searchUrlStream);
  var imageUrlStream = imageLinkStream(siteUrlStream, keyword)
        .errors(noop)
        .take(200);

  // siteUrlStream.each(_.log);
  imageUrlStream.each(_.log);
  // imageUrlStream
  //   .map(downloadImagesTo('./output/ellie-images', 'ellie-goulding-'))
  //   .each(_.log);
}
