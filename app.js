'use strict;'

//  ******* Moz Bigflags ******
//  ***************************
//
//  "ut"   : "title"              , // 1
// 	"uu"   : "url"                , // 4
// 	"ueid" : "external links"     , // 32
// 	"uid"  : "links"              , // 2048
// 	"umrp" : "mozrank"            , // 16384
// 	"fmrp" : "subdomain mozrank"  , // 32768
// 	"us"   : "http status code"   , // 536870912
// 	"upa"  : "page authority"     , // 34359738368
// 	"pda"  : "domain authority"     // 6871947673
//
//  ***************************
//  ***************************


// requiring all the modules
var http = require('http'),
	querystring = require('querystring'),
	fs = require('fs'),
	CryptoJS = require("crypto-js"); 

var commonHeader = {'Content-Type': 'text/html'}; // text/html header
var temp; // to hold response in queryRoute function. Used in siteMetrics function later

// creating http server
var port = Number(process.env.PORT) || 3000;
http.createServer(function(request, response) {
	homeRoute(request, response);
	queryRoute(request, response);
}).listen(port);

console.log('server is running at localhost:3000');


// for handling home page route/request
function homeRoute(request, response) {	
	
	// short circuiting favicon requests
	if (request.url === '/favicon.ico') {
		response.writeHead(200, {'Content-Type': 'image/x-icon'} );
		response.end();
		return;
  	}

	// checking if the home page is requested
	if(request.url === '/') {

		// if the method is GET, simply load the static content
		if(request.method.toLowerCase() == 'get') {
			response.writeHead(200, commonHeader);
			view('header', {}, response);
			view('search', {}, response);
			view('footer', {}, response)
			response.end();
		} else {
			// if the method if POST (form submission), redirect to that page
			request.on('data', function(postBody){
				var inputUrl = querystring.parse(postBody.toString()).query;
				inputUrl = inputUrl.replace(/.*?:\/\//g, '');
				response.writeHead( 303, { 'Location': '/' + inputUrl } );
				response.end();
			});
		}
	
	}

}


// for handling query route/request
function queryRoute(request, response) {
	
	// short circuiting favicon requests
	if (request.url === '/favicon.ico') {
		response.writeHead(200, {'Content-Type': 'image/x-icon'} );
		response.end();
		return;
  	}

  	// if query > 0 i.e. genuine entry, load the results page
	var query = request.url.replace('/', '');	
	if (query.length > 0) {
		
		response.writeHead(200, commonHeader);
		
		view('header', {}, response);
		view('search_again', {}, response);
		
		// temporary variable to hold response. Used in siteMetrics function.
		temp = response;

		// calling siteMetrics to GET data from Moz
		siteMetrics(query);
		
	}

}


//  to replace {{key}} in results.html with respective values from API call
function mergeValues(values, content) {
	for(var key in values) {
		content = content.toString().replace('{{' + key + '}}', values[key]);
	}
	return content;
}


// read values from 'views' html temaplates and write them to 'response'
function view(template, values, response) {
	// read ftom html templates
	var fileContents = fs.readFileSync('./views/' + template + '.html', {econding: 'utf8'});
	
	fileContents = mergeValues(values, fileContents);

	response.write(fileContents);
}


// making request to Moz API and writing it in results.html view
function siteMetrics(query) {
	
	// all free data from Moz API - sum of required bitflags - see top page comment 
	var parameters = "?Cols=103616137253";

	// moz keys
	var accessID = "your accessID";
	var secretKey = "your secretKey";

	// request expires after 5 mins (300s)
	var expires = Math.round(new Date().getTime() / 1000) + 300;

	// to calculate HMAC-SHA1 hash using CryptoJS 
	var stringToSign = accessID + "\n" + expires;
	var hash = CryptoJS.HmacSHA1(stringToSign, secretKey);
	var signature = encodeURIComponent(hash.toString(CryptoJS.enc.Base64));

	var authentication = "&AccessID=" + accessID + "&Expires=" + expires + "&Signature=" + signature;
	
	// GET request options for Moz API
	var options = {
		"method": "GET",
		"hostname": "lsapi.seomoz.com",
		"port": null,
		"path": "/linkscape/url-metrics/" + query + parameters + authentication,
		"headers": {
			"cache-control": "no-cache"
		}
	}
	
	// http request to Moz API
	var request = http.request(options, function (response) {
	  
		var chunks = [];

		response.on("data", function (chunk) {
			chunks.push(chunk);
		});

		response.on("end", function () {

			var body = Buffer.concat(chunks);
			responseJSON = JSON.parse(body);	
			
			if (responseJSON.status != 401) {
				
				var values = {
					title: responseJSON.ut || "not available",
					url: responseJSON.uu.replace('/', '') || "not available",
					external_links: formatNumber(responseJSON.ueid) || "not available", 
					links: formatNumber(responseJSON.uid) || "not available", 
					mozrank: Math.round(responseJSON.umrp * 10) / 10 || "not available", 
					subdomain_mozrank: Math.round(responseJSON.fmrp * 10) / 10 || "not available", 
					http_status: responseJSON.us || "not available", 
					page_authority: Math.round(responseJSON.upa * 10) / 10 || "not available", 
					domain_authority: Math.round(responseJSON.pda * 10) / 10 || "not available"
				}

				view('results', values, temp);
			
			} else {
				view('no_results', {}, temp);
			}

			view('footer', {}, temp);
			temp.end();
		});

	});

	request.end();

}


// formatting number to add commas at thousands place
function formatNumber(num) {
    
    var str = num.toString();
    var newString = "";
    
    while(num.toString().length > 3) {
        
        var tempStr;
        
        if((num % 1000).toString().length === 2) {
            tempStr = ",0" + parseInt(num % 1000);
        } else {
            tempStr = "," + parseInt(num % 1000);
        }
        
        newString = tempStr + newString;
        num = parseInt(num / 1000);
    }
    
    newString = num.toString() + newString;

    return newString;
}
