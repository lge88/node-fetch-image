
function getJSON(url, done) {
  var xmlhttp;

  if (window.XMLHttpRequest) {
    // code for IE7+, Firefox, Chrome, Opera, Safari
    xmlhttp = new XMLHttpRequest();
  } else {
    // code for IE6, IE5
    xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
  }

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 ) {
      if(xmlhttp.status == 200){
        done(null, xmlhttp.responseText);
      } else if(xmlhttp.status == 400) {
        done('There was an error 400');
      }
      else {
        done('something else other than 200 was returned');
      }
    }
  };

  xmlhttp.open("GET", url, true);
  xmlhttp.send();
}

getJSON('./image-links.txt', function(err, str) {
  var links = str.trim().split('\n');
  var images = links.slice(0, 20).map(function(url) {
    var item = document.createElement('img');
    // item.className = 'item';
    // item.style.background = 'url(' + url + ') no-repeat center center fixed';
    item.src = url;
    item.alt = '';
    return item;
  });
  var container = document.getElementById('container');
  images.forEach(function(img) {
    container.appendChild(img);
  });
});
