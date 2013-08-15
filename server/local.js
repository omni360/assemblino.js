//parameters
var port = 35689;
var arduinoEnabled = true;
var username = 'Desktop';
var publicFolder = __dirname + '/../public';

//requires
var fs = require('fs');
var express = require('express');
var http = require('http');
var url = require('url');
var app = express();

//exports
var assemblinoBackend;
var callable = {};
exports.callable = callable;
exports.username = username;
exports.arduinoEnabled = arduinoEnabled;
exports.addCallable = addCallable;
exports.app = app;

//configure express
app.use(express.static(publicFolder));
app.use(express.bodyParser());

function genericRequestProcessor(pathname, options, res, req) {
    try {
        if (typeof options == 'object') {
            options.username = username;
        }
        var answer = {404: pathname};
        if (callable[pathname]) {
            answer = callable[pathname](options, req);
        }
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(answer));
    } catch (e) {
        console.log(e);
        res.end(JSON.stringify({error: e}));
    }
}

function genericGetProcessor(req, res) {
    try {
        var urlParts = url.parse(req.url, true);
        var options = urlParts.query;
        var pathname = urlParts.pathname;
        genericRequestProcessor(pathname, options, res, req);
    } catch (e) {
        console.log(e);
    }
}

function genericPostProcessor(req, res) {
    try {
        var options = req.body;
        var pathname = req.url;
        genericRequestProcessor(pathname, options, res, req);
    } catch (e) {
        console.log(e);
    }
}

function addCallable(uri, fun) {
    app.get(uri, genericGetProcessor);
    app.post('/ajax'+uri, genericPostProcessor);
    callable[uri] = fun;
    callable['/ajax'+uri] = fun;
}

console.log("");
assemblinoBackend = require('./backend-assemblino.js');
if (arduinoEnabled) require('./backend-arduino.js');
app.listen(port);
console.log('listening on http://localhost: ' + port);
