var fs = require('fs');
var underscore = require('underscore');
var server = require('./local.js');
var desktopFiles = [];

function whichDesktop() {
    fs.readdir(__dirname + '/../public/components/', function (err, paths) {
        paths = underscore.without(paths, '_public.js', '_desktop_options.js');
        paths.sort();
        desktopFiles = paths;
    });
}
function ignore(){
    return {status: 'ignore'};
}
function updateDesktopFilesList(){
    whichDesktop();
    return {status: 'ignore'};
}
//these functions are used only for website storage
server.addCallable("/saveInfo", updateDesktopFilesList);
server.addCallable("/update", ignore);
server.addCallable("/delete", ignore);
server.addCallable("/insert", ignore);
server.addCallable("/changes", ignore);
server.addCallable("/getlist", ignore);

server.addCallable("/getInfo", function (options) {
    whichDesktop();
    return {
        user: server.username,
        info: JSON.stringify({
            user: server.username,
            lastEdited: 0
        }),
        serverTime:  Date.now(),
        arduino: server.arduinoEnabled,
        desktopFiles: desktopFiles
    };
});

whichDesktop();


