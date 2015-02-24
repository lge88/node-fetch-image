var run = require('../fetch-image').run;
var isValidUrl = require('../fetch-image').isValidUrl;
var expect = require('expect.js');

describe('image links', function() {
  it('should fetch a list of image links', function(done) {
    var options = {
      keyword: 'cat',
      numGoogleResults: 10,
      numImages: 10,
      destDirectory: ''
    };

    run(options).toArray(function(links) {
      expect(links.length).to.be(10);
      links.forEach(function(link) {
        expect(isValidUrl(link)).to.be(true);
      });
      done();
    });
  });
});
