//interface for user alerts
function notify(msg) {
    console.log(msg);
    alert(msg);
}

var NEXT_INT = {};
function nextInt() {
    var key = arguments && arguments[0] || "";
    var value = NEXT_INT[key] !== undefined ? NEXT_INT[key] : -1;
    value++;
    NEXT_INT[key] = value;
    return value;
}

function resetNextInt(){
    NEXT_INT = {};
}
function nextName(name) {
    var last;
    while((last = name.charAt(name.length-1)).match(/\d/)){
        name = name.substr(0, name.length-1);
    }
    return name + nextInt(name);
}

function codeObject(code, args, objName) {
    try {
        var fun = new Function(code);
        var obj = fun(JSON.parse(args || "{}"));
        if (objName && obj) {
            obj.databaseName = objName;
        }
        return obj;
    } catch (e) {
        console.error(e);
        return null;
    }
}

function validName(name) {
    if (!name) {
        return null;
    }
    name = name.replace(/\W/igm, '');
    if (window.hasOwnProperty(name)) {
        return null;
    }
    if (name.match(/^\d/)) return null;
    return name;
}

function flexibleName(name) {
    //allows spaces
    if (!name) {
        return null;
    }
    name = name.replace(/[^#_\.\-0-9a-zA-Z]+/igm, ' ');
    name = jQuery.trim(name);
    if (!name || window.hasOwnProperty(name)) {
        return null;
    }
    if (name.match(/^\d/)) return null;
    return name;
}

/**
 * remove references to properties in this object
 * @param obj the object
 */
function destroyObject(obj) {
    if (typeof obj !== 'object') return;
    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
            obj[i] = undefined;
        }
    }
}

function randomColor() {
    return Math.round(0xffffff * Math.random());
}

function uriParameter(parameter) {
    //http://stackoverflow.com/questions/979975/how-to-get-the-value-from-url-parameter
    try {
        var vars = window.location.search.substring(1).split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            if (pair[0] === parameter) return pair[1];
        }
    } catch (e) {
    }
    return undefined;
}

function formatedTime(){
    var date = new Date();
    var year = date.getFullYear();
    var month = "" + (date.getMonth()+1); if (month.length<2) month = "0" + month;
    var day = "" + date.getDate(); if (day.length<2) day = "0" + day;
    var hour = "" + date.getHours(); if (hour.length<2) hour = "0" + hour;
    var min = "" + date.getMinutes(); if (min.length<2) min = "0" + min;
    return year + "-" + month + "-" + day + " " + hour + ":" + min;

}

function isChrome () {
    return  /Chrome/.test(navigator.userAgent) && /Google/.test(navigator.vendor);
}
