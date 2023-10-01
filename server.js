#!/usr/bin/env node

const USE_COOKIES_FOR_FILES = true;
const COOKIE_EXPIRE_MS = 1000*60*60*24*500; // let cookies expire in 500 days 
const LOGFILE = "logs.txt"

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

function getPOSTDataAsync(req) {
	return new Promise((resolve, reject) =>  {
		if (req.method != "POST")
			resolve("");
		let data = ""
		req.on('data', (d) => {
			data += d;
		});
		req.on('end', () => {
			resolve(data);
		});
	});
}

function getText(req, variable, postdata) {
	if (req.method == "GET") {
		let q = url.parse(req.url, true);
		return q.query[variable];
	} else if (req.method == "POST") {
		return postdata;
	} else {
		throw new Error("Unsupported request method type " + req.method);
	}
}

async function respondFile(req, res) {
	let q = url.parse(req.url, true);
	let filename = "." + q.pathname;
	filename = unEscape(filename);
	if (filename == "./")
		filename = "./main.html";
	let fsfun = (filename, text, cb) => cb();
	let text = await getPOSTDataAsync(req); 
	logFile(LOGFILE, `\n${req.method} ${req.url}\n${JSON.stringify(req.headers)}`);
	if (req.method == "POST")
		logFile(LOGFILE, "POST: " + text);

	let isWriting = true;
	try {
		if (q.query.append != undefined) {
			fsfun = fs.appendFile;
			text = getText(req, "append", text) + "\n";
		} else if (q.query.write != undefined) {
			fsfun = fs.writeFile;
			text = getText(req, "write", text);
		} else {
			isWriting = false;
		}
	} catch (err) {
		return respondError(res, "Data to be written are undefined");
	}

	let folder = "";
	let randName;
	if (USE_COOKIES_FOR_FILES) {
		let cookie =  req.headers["cookie"];
		if (cookie) {
			console.log("Received cookie " + cookie);
			// extract folder cookie
			cookie.split(";").forEach((c) => {
				let [name, ...rest] = c.split("=");
				if (name.trim() == "folder") {
					randName = rest.join();
					folder =  "Cookies/" + randName + "/";
					console.log("Folder is " + folder);
					// if folder for cookie doesnt exist, let the cookie expire now 
					if (!fs.existsSync(folder)) {
						res.setHeader("Set-Cookie", ["folder="+ randName + ";Expires="+new Date(Date.now()).toUTCString()]); 
					// otherwise extend cookie 
					} else {
						// let expireDate = new Date(Date.now() + COOKIE_EXPIRE_MS); 
						// res.setHeader("Set-Cookie", ["folder="+ randName + ";Expires="+expireDate.toUTCString()]); 
					}
				}
			});
		} 
		if (isWriting && !folder) {
			// if writing and no cookie yet, generate new folder and set the cookie 
			do {
				randName = Math.floor(Math.random() * 1e8).toString(16);	
				folder = "./Cookies/" + randName + "/";
			} while (fs.existsSync(folder)); 
			let expireDate = new Date(Date.now() + COOKIE_EXPIRE_MS); 
			res.setHeader("Set-Cookie", ["folder="+ randName + ";Expires="+expireDate.toUTCString()]); 
			if (!fs.existsSync("Cookies"))
				fs.mkdirSync("Cookies");
			fs.mkdirSync(folder);
			// write expiry date to file in folder
			fs.writeFile(folder+".expires", expireDate.toUTCString(), (err) => {if (err)console.error(err);});
			console.log("Created new cookie with folder " + folder)
		}
		if (isWriting)
			console.log("Writing to file " + folder + filename);
	}

	fsfun(folder + filename, text, () =>  {
		console.log(folder + filename + " File exists: " + fs.existsSync(folder+filename));
		if (fs.existsSync(folder + filename))
			filename = folder + filename; 

		fs.readFile(filename, (err,data) => {
			if (err) {
				console.log("File " + filename + " not found");
				respondError(res, "File " + filename + " not found");
			} else {
				if (filename.endsWith(".js")) {
					res.writeHead(200, {'Content-Type': 'text/javascript'});
				} else if (filename.endsWith(".http")) {
					res.writeHead(200, {'Content-Type': 'text/html'});
				} else {
					res.writeHead(200);
				}
				res.end(data);
			}
			console.log("Responded with file " + filename);
			logFile(LOGFILE, `Response (file ${filename}): ${res.statusCode} ${JSON.stringify(res.getHeaders())}`);
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

	// remove variables from URL  
	reqUrl = reqUrl.split("?")[0];
	// preserve variables except custom ones
	let variables = {}
	Object.keys(parsedReq.query).forEach((key) => {
		if (!["origin", "referer"].includes(key))
			variables[key] = parsedReq.query[key];
	})
	if (Object.keys(variables).length > 0) {
		reqUrl += "?";
		Object.keys(variables).forEach((key) => reqUrl += key+"="+variables[key]+"&");
	}

	const outReq = protocol.request(reqUrl, options, response => {
		console.log("Got response code " + response.statusCode + " for url " + reqUrl);
		returnedStatus = response.statusCode;
		returnedHeaders = response.headers;
		logFile(LOGFILE, `Response (extern ${reqUrl}): ${returnedStatus} ${JSON.stringify(returnedHeaders)}`);

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

	logFile(LOGFILE, `\n${outReq.method} ${reqUrl}\n${JSON.stringify(outReq.getHeaders())}`);

	if (req.method == 'POST') {
		// TODO check if outReq didnt timeout/error before writing/ending it necessary?
		req.on('data', (data) => {
			logFile(LOGFILE, "Post:\n"+data);
			outReq.write(data);
		});
		req.on('end', () => {
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


// on startup: check cookie folders and remove the expired ones 
console.log("Checking cookie files for expiry...");
let cookieFolders = fs.readdirSync("./Cookies/");
cookieFolders.forEach((f) => {
		let expireDate;
		try { 
			let expireStr = fs.readFileSync("./Cookies/"+f+"/.expires");
			expireDate = new Date(Date.parse(expireStr));
			console.log("Cookie " + f + " expires at " + expireDate.toUTCString());
		} catch {
			expireDate = null;	
			console.log("Cookie " + f + ": Expiry date not stored, deleting...");
		}
		if (!expireDate || expireDate < Date.now()) {
			try {
				fs.rmdirSync("./Cookies/"+f, {recursive: true});
				console.log("Cookie " + f + ": Removed files due to expiry");
			} catch (err) {
				console.err("Cookie " + f + ": Error removing folder - " + err);
			};
		}
});

// create http and equivalent https server
http.createServer(requestListen).listen(80);

const options = {
  key: fs.readFileSync('keys/server.key'),
  cert: fs.readFileSync('keys/server.cert'),
};
https.createServer(options, requestListen).listen(443);

console.log("Started HTTP and HTTPS server.");
