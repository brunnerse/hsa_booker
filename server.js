#!/usr/bin/env node

var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');

function sleep(msec) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, msec);
    })
}

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

function logFile(filename, log) {
	fs.appendFile(filename, log + "\n", (err) => {if (err) console.log("[LOG] Error: " + err);});
}


// If external server wants to redirect to itself, modify the location
function modifyLocationInHeader(header) {
	if (header.location) {
		header.location = "/extern/"+header.location;
	}
}


function respondError(res, message="") {
	res.writeHead(404, {'Content-Type': 'text/html'});
	res.end(message);
}

function respondFile(req, res) {
	let q = url.parse(req.url, true);
	var filename = "." + q.pathname;
	filename = unEscape(filename);
	if (filename == "./")
		filename = "./main.html";
	let fsfun = (filename, text, cb) => cb();
	let text; 
	if (q.query.append != undefined) {
		fsfun = fs.appendFile;
		text  = q.query.append + "\n";
	} else if (q.query.write != undefined) {
		fsfun = fs.writeFile;
		text  = q.query.write;
	}
	fsfun(filename, text, () =>  {
		fs.readFile(filename, (err,data) => {
			if (err) {
				console.log("File " + filename + " not found");
				respondError(res, "File " + filename + " not found");
				return;
			}
			if (filename.endsWith(".js")) {
				res.writeHead(200, {'Content-Type': 'text/javascript'});
			} else if (filename.endsWith(".http")) {
				res.writeHead(200, {'Content-Type': 'text/html'});
			} else {
				res.writeHead(200);
			}
			res.end(data);
			console.log("Responded with file " + filename);
		});
	});
}

function respondExtern(req, res, reqUrl) {
	let protocol;
	let parsedReq = url.parse(reqUrl, true);

	if (!isValidURL(reqUrl)) 
 		return respondError(res, "URL \"" + reqUrl + "\" invalid!");

	console.log("Executing external call to " + reqUrl);

	if (parsedReq.protocol.includes("https"))
		protocol = https;
	else
		protocol = http;

	let options = {
		method : req.method, 
		headers : req.headers
	}

	options.headers.host = parsedReq.hostname;
	if (parsedReq.query["origin"])
		options.headers.origin = parsedReq.query["origin"];
	else
		delete options.headers.origin;
	if (parsedReq.query["referer"])
		options.headers.referer = parsedReq.query["referer"];
	else
		delete options.headers.referer;

	// remove variables from URL  TODO preserve variables except custom ones
	reqUrl = reqUrl.split("?")[0];

	const outReq = protocol.request(reqUrl, options, response => {
		console.log("Got code " + response.statusCode);
		returnedStatus = response.statusCode;
		returnedHeaders = response.headers;
		logFile("external.txt", `Response ${returnedStatus} ${JSON.stringify(returnedHeaders)}`);

		// Modify header: remove content security policy and modify location (for 304 codes) 
		delete returnedHeaders["content-security-policy"];
		modifyLocationInHeader(returnedHeaders);

		res.writeHead(returnedStatus, returnedHeaders);

		response.on('data', (chunk) => {
			if (!res.finished)
				res.write(chunk)
			//console.log("Received chunk of size %d", chunk.length)
		});
		response.on('end', async function()  {
			console.log("Request finished: " + reqUrl);
			res.end();
		});
		response.on('timeout', () => {
			console.log("Request timed out: " + reqUrl);
			throw new Error("external site timeout");
		})
	});

	const errorFun = (e) => {
		console.error(`Problem with external request to ${reqUrl}: ${e}`);
		if (!res.headersSent)
			respondError(res, e);
		else
			res.end(e);
	};

	outReq.on('timeout', () => {
		errorFun("timeout");});
	outReq.on('error', (err) => errorFun("error: " + err.message));

	outReq.setTimeout(5000);

	logFile("external.txt", `\n${outReq.method} ${reqUrl}\n${JSON.stringify(outReq.getHeaders())}`);

	if (req.method == 'POST') {
		// TODO check if outReq didnt timeout/error before writing/ending it
		req.on('data', (data) => {
			logFile("external.txt", "Post:\n"+data);
			outReq.write(data);
		});
		req.on('end', () => {
			console.log("Ending outReq...");
			outReq.end();
		});
	} else {
		outReq.end();
	}
}


function requestListen(req, res) {
	let pathArr = req.url.split('/')
	console.log("Received [" + req.method + "] request for " + req.url);

	req.on("abort", () => console.log("Abort received"));
	switch (pathArr[1]) {
		case "extern":
			pathArr.splice(0,2);
			respondExtern(req, res, pathArr.join("/"));
			break;
		case "hsa":
			pathArr.splice(1,1);
			respondExtern(req, res, "https://hsa.sport.uni-augsburg.de" + pathArr.join('/'));
			break;
		default:
			// Client requests file;
			// check first if file from HSA server is requested
			const hsaFolders = ["index", "templates", "images", "buchsys", "media", "SysBilder"]
			if (hsaFolders.includes(pathArr[1])) {
				respondExtern(req, res, "https://anmeldung.sport.uni-augsburg.de" + pathArr.join('/'));
			} else {
				// return file from own file system
				respondFile(req, res);
			}
	}
}



http.createServer(requestListen).listen(80);


const options = {
  key: fs.readFileSync('keys/server.key'),
  cert: fs.readFileSync('keys/server.cert'),
};
https.createServer(options, requestListen).listen(443);
