var http = require('http');
var https = require('https');
var fcgi = require('node-fastcgi');
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

function respondExtern(res, query) {
	let protocol;
	let path = query.url;
	if (path.startsWith("https"))
		protocol = https;
	else
		protocol = http;

	// append other variables in query to path
	if (Object.keys(query).length > 1) {
		path += '?';
		for (let key of Object.keys(query)) {
			if (key != "url") {
				path += key+"="+query[key]+"&";
			}
		}
	}	

	options = {
		method : 'GET',
		timeout : 5000
	 }
	console.log("Executing external call to " + path)
	const req = protocol.request(path, options, response => {
		console.log("Got code " + response.statusCode);
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
	}).on('error', (e) => {
		console.error(`problem with request: ${e.message}`);
		if (!res.headersSent)
			respondError(res, e.message);
		else
			res.end(e.message);
	});

	// Could write post data here
	// req.write(postdata);
	req.end();
}


function respondFCGI(req, res) {
	if (req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		res.end("It's working");
	} else if (req.method === 'POST') {
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		var body = "";

		req.on('data', function (data) { body += data.toString(); });
		req.on('end', function () {
			res.end("Received data:\n" + body);
			console.log("POST data: " + body)
		});
	} else {
		res.writeHead(501);
		res.end();
	}
}


function requestListen(req, res) {
	console.log("Received [" + req.method + "] request for " + req.url)
	var q = url.parse(req.url, true);

	let filename; 
	switch (q.pathname) {
		case "/extern":
			if (q.query.url) {
				if (!isValidURL(q.query.url)) {
					respondError(res, "URL \"" + q.query.url + "\" invalid!");
				} else {
					respondExtern(res, q.query);
				}
			} else {
				respondError(res, "Query missing");
			}
			break;
		case "/":
			respondFile(res, "./main.html");
			break;
		case "/cgi/anmeldung.fcgi":
			respondFCGI(req, res);
			break;
		default:
			// Client requests file;
			// check first if file from HSA server is requested
			const hsaFolders = ["index", "templates", "images", "buchsys", "media", "SysBilder"]
			let pathArr = q.pathname.split('/');
			if (pathArr[1] == 'hsa') {
				pathArr.splice(1,1);
				q.query.url = "https://hsa.sport.uni-augsburg.de" + pathArr.join('/');
				respondExtern(res, q.query);
			} else if (hsaFolders.includes(pathArr[1])) {
				q.query.url = "https://anmeldung.sport.uni-augsburg.de" + pathArr.join('/');
				respondExtern(res, q.query);
			} else {
				// return file from own file system
				respondFile(res, "." + q.pathname);
			}
	}
}



http.createServer(requestListen).listen(80);

fcgi.createServer(function (req, res) {
	console.log("Received FCGI " + req);
	if (req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		res.end("It's working");
	} else if (req.method === 'POST') {
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		var body = "";

		req.on('data', function (data) { body += data.toString(); });
		req.on('end', function () {
			res.end("Received data:\n" + body);
		});
	} else {
		res.writeHead(501);
		res.end();
	}
}).listen(81);
