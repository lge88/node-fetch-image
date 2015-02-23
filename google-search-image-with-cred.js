var fs = require('fs');
var queryString = require('querystring');
var req = require('request');
var _ = require('highland');
var assign = require('object-assign');
var lazyRequest = require('./lazyRequest');
var jsonParser = require('./jsonParser');

var GOOGLE_CUSTOM_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1?';

var defaultSearchParams = {
  searchType: 'image',
  fields: 'items(image,link)'
};

// credentials: { cx: 000000000000000000000:aaaaaa00000,
//   key: ABCabc012aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa };
function ImageSearchStreamer(credentials, options) {
  this.searchEndpoint = GOOGLE_CUSTOM_SEARCH_ENDPOINT;
  this.searchParams = assign({}, defaultSearchParams, credentials, options);
}

ImageSearchStreamer.prototype.search = function(q, options) {
  var getSearchUrl = this.getSearchUrl.bind(this);

  function makeUrlIterator(num) {
    var count = 0;
    return {
      hasNext: function() { return count < num; },
      next: function() {
        var opt = assign({}, options);
        delete opt.num;
        opt.start = count + 1;

        count += 10;
        if (count > num)
          opt.num = num - (count - 10);
        return getSearchUrl(q, opt);
      }
    };
  }

  var iter  = makeUrlIterator(options && options.num || 10);

  return lazyRequest(iter, function(s) {
    return s
      .through(jsonParser)
      .map(function(obj) { return obj.items; });
  });
};

ImageSearchStreamer.prototype.getSearchUrl = function(q, options) {
  var params = assign({}, this.searchParams, { q: q }, options);
  var paramsStr = queryString.stringify(params);
  return this.searchEndpoint + paramsStr;
};

if (!module.parent) {
  var readJSON = function(filename) {
    return JSON.parse(fs.readFileSync(filename));
  };
  var cred = readJSON('.credentials');
  var iss = new ImageSearchStreamer(cred);

  var q = process.argv[2], num = parseInt(process.argv[3]);

  var printUsageAndExit = function() {
    console.log('Usage: ImageSearchStreamer <query> [number of results]');
    process.exit();
  };

  if (!q) {
    printUsageAndExit();
  }

  if (isNaN(num))
    num = 10;

  iss.search(q, { num: num })
    .map(function(obj) { return obj.image.thumbnailLink; })
    .each(_.log);
}
