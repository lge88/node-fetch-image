# node-fetch-image
Fetch images from web.

## Example
- Fetch me `1000` pictures of Katy Perry to `katyp-pics` folder and name them `katyp-0.jpg`, `katyp-1.png` ...
```sh
bin/fim 'katy perry' -d katyp-pics -n 1000 -p 'katyp-'
```
- Give me 1000 image links of Katy Perry (without downloading them). 
```sh
bin/fim 'katy perry' -n 1000
```
Output:
```
http://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Katy_Perry_November_2014.jpg/220px-Katy_Perry_November_2014.jpg
http://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Katy_Perry_performing.jpg/170px-Katy_Perry_performing.jpg
http://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Katy_Perry%E2%80%93Zenith_Paris.jpg/170px-Katy_Perry%E2%80%93Zenith_Paris.jpg
...
```

## Install
`npm install -g fetch-image`

## Usage
```
Usage: fim <keyword> [options]
  -d, --directory             output directory, default is ''. 
                              If empty, ouput image links instead of download.
  -n, --num-images            number of images to download, default is 100.
  -p, --prefix                file prefix, default is ''
  --num-google-results        number of google search image results to start, 
                              default is 100.
```

## How it works
- Send a query to google image search.
- Parse the google search result page and extract related site links.
- Scrape each site for images links related to the query.
- Download each image to given folder.
