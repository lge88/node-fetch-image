# node-fetch-image
Fetch images from web.

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

## Examples
```sh
fim 'katy perry' -d katyp-pics -n 1000 -p 'katyp-'
```
Fetch me `1000` pictures of Katy Perry to `katyp-pics` folder and name them `katyp-0.jpg`, `katyp-1.png` ...
