var http = require('http');
var url = require('url');
var fs = require('fs');
var events = require('events');

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
		header.location = u.pathname;
	}
}

function respondError(res, message="") {
	res.writeHead(404, {'Content-Type': 'text/html'});
	res.end(message);
}

function respondFile(res, filename) {
	fs.readFile(filename, function(err, data) {
		if (err) {
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

var eventEmitter = new events.EventEmitter();


// Simple server for Date
http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.write("The date is " + Date() + "</br>");
	res.write(req.url);
	var q = url.parse(req.url, true)
	console.log(q);
	var query = q.query;
	console.log(query)
	var txt = "</br>" + query.year + "\t" + query.month + "</br>";
	res.write(txt);
	res.end();
	fs.appendFile("requests.txt", Date() + "\t" + req.url + "\n", function (err){
		if (err) throw err;
	});
}).listen(8080);


// Simple server forwarding files
http.createServer(function (req, res) {
	var q = url.parse(req.url, true);
	var filename = "." + q.pathname;
	fs.readFile(filename, function(err, data) {
		  if (err) {
			res.writeHead(404, {'Content-Type': 'text/html'});
			return res.end("Not found");
		  }
		  res.writeHead(200, {'Content-Type': 'text/html'});
		  res.write(data);
		  return res.end();
		});
	eventEmitter.emit('testEvent');
}).listen(81);


var eventHandler = function() {
	console.log("Event triggered!");
}
eventEmitter.on('testEvent', eventHandler);



// Simple server forwarding another website
http.createServer(function (req, res) {
	var q = url.parse(req.url, true);
	var forwardUrl = "https://hsa.sport.uni-augsburg.de" + q.pathname;
	//var forwardUrl = "http:///ismycomputeron.com" + q.pathname;
	
	const options = {
		method: 'GET'/*,
		hostname: 'www.google.com',
		port: 80,
		path: '/upload',

		headers: {
		  'Content-Type': 'application/json',
		  'Content-Length': Buffer.byteLength(postData),
		},*/
	  };

	var body = [];  
	var returnedStatus;
	var returnedHeaders;

	console.log("==\nGetting URL " + forwardUrl + "\n==\n")

	var forwardReq = https.get(forwardUrl, response => {
		//console.log("Got code " + response.statusCode);
		returnedStatus = response.statusCode;
		returnedHeaders = response.headers;
		console.log(returnedStatus);
		modifyLocationInHeader(returnedHeaders);

		res.writeHead(returnedStatus, returnedHeaders);
		response.on('data', (chunk) => {
			res.write(chunk)
			body.push(chunk);
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
}).listen(80);