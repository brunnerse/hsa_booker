var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');


function escape(htmlStr) {
	return htmlStr.replace(/&/g, "&amp;")
		  .replace(/</g, "&lt;")
		  .replace(/>/g, "&gt;")
		  .replace(/"/g, "&quot;")
		  .replace(/'/g, "&#39;")
		  .replace(/ /g, "%20");        
}
function unEscape(htmlStr) {
    htmlStr = htmlStr.replace(/&lt;/g , "<");	 
    htmlStr = htmlStr.replace(/&gt;/g , ">");     
    htmlStr = htmlStr.replace(/&quot;/g , "\"");  
    htmlStr = htmlStr.replace(/&#39;/g , "\'");   
    htmlStr = htmlStr.replace(/&amp;/g , "&");
	htmlStr = htmlStr.replace(/%20/g, " ");
    return htmlStr;
} 

function isValidURL(str) {
    try {
      new url.URL(str);
      return true;
    } catch (err) {
      return false;
    }
}

function isHSAPath(str) {
	indices = ["/index", "/templates", "/images", "/buchsys", "/media", "/SysBilder"]
	for (ind of indices) {
		if (str.startsWith(ind))
			return true;
	}
	return false;
}

// If external server wants to redirect to itself, modify the location
function modifyLocationInHeader(header) {
	if (header.location) {
		let u = url.parse(header.location, true);
		header.location = "/extern?url="+header.location;
	}
}


function respondError(res, message="") {
	res.writeHead(404, {'Content-Type': 'text/html'});
	res.end(message);
}
 
function respondFile(res, filename) {
	filename = unEscape(filename);
	fs.readFile(filename, function(err, data) {
		if (err) {
		  console.log("File " + filename + " not found");
		  respondError(res, "File " + filename + " not found");
		  return;
		}
		if (filename.endsWith(".js")) {
		  res.writeHead(200, {'Content-Type': 'text/javascript'});
		} else {
		  res.writeHead(200, {'Content-Type': 'text/html'});
		}
		res.write(data);
		res.end();
	  });
}

function respondExtern(res, url) {
	console.log("Executing external call to " + url)
	http.get(url, response => {
		//console.log("Got code " + response.statusCode);
		returnedStatus = response.statusCode;
		returnedHeaders = response.headers;
		console.log(returnedStatus);
		modifyLocationInHeader(returnedHeaders);
		res.writeHead(returnedStatus, returnedHeaders);
		response.on('data', (chunk) => {
			res.write(chunk)
			//console.log("Received chunk of size %d", chunk.length)
		});
		response.on('end', () => {
			console.log("Finished request.");
			res.end();
		});
		response.on('error', (e) => {
			console.error(`problem with request: ${e.message}`);
			res.end();
		});
	});
}

function respondExternSecure(res, url) {
	console.log("Executing external https call to " + url)
	https.get(url, response => {
		//console.log("Got code " + response.statusCode);
		returnedStatus = response.statusCode;
		returnedHeaders = response.headers;
		console.log(returnedStatus);
		//console.log(returnedHeaders);
		modifyLocationInHeader(returnedHeaders);
		//console.log(returnedHeaders);
		res.writeHead(returnedStatus, returnedHeaders);
		response.on('data', (chunk) => {
			res.write(chunk)
			//console.log("Received chunk of size %d", chunk.length)
		});
		response.on('end', () => {
			console.log("Finished request.");
			res.end();
		});
		response.on('error', (e) => {
			console.error(`problem with request: ${e.message}`);
			res.end();
		});
	}).on("error", () => respondError(res, "Connection to " + url + " timed out"));
}


function requestListen(req, res) {
	console.log("Got request for " + req.url)
	var q = url.parse(req.url, true);

	let filename; 

	//console.log(q)

	switch (q.pathname) {
		case "/extern":
			if (q.query.url) {
				if (!isValidURL(q.query.url)) {
					respondError(res, "URL \"" + q.query.url + "\" invalid!");
				} else {
					if (q.query.url.startsWith("https"))
						respondExternSecure(res, q.query.url);
					else
						respondExtern(res, q.query.url);
				}
			} else {
				respondError(res, "Query missing");
			}
			break;
		case "/":
			respondFile(res, "./main.html");
			break;
		default:
			if (isHSAPath(q.pathname)) {
				respondExternSecure(res, "https://anmeldung.sport.uni-augsburg.de" + q.pathname);
			} else {
				respondFile(res, "." + q.pathname);
			}
	}
}




http.createServer(requestListen).listen(80);
