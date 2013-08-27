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

function randomValue(min, max) {
    return (min||0) + ((max||0)-(min||0)) * Math.random();
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


function Vec3(){
    if (!arguments.length){
        return new THREE.Vector3();
    } else if (arguments.length == 3){
        return new THREE.Vector3(arguments[0], arguments[1], arguments[2]);
    } else if (arguments[0] instanceof Array && arguments[0].length == 3){
        var a = arguments[0];
        return new THREE.Vector3(a[0], a[1], a[2]);
    } else if (arguments[0] instanceof THREE.Vector3){
        return arguments[0];
    } else if ((arguments.length == 1) && arguments[0].x){
        return Vec3(arguments[0].x, arguments[0].y, arguments[0].z);
    }
    return undefined;
}

function Vec4(){
    if (!arguments.length){
        return new THREE.Quaternion();
    } else if (arguments.length == 4){
        return new THREE.Quaternion(arguments[0], arguments[1], arguments[2], arguments[3]);
    } else if (arguments[0] instanceof Array && arguments[0].length == 4){
        var a = arguments[0];
        return new THREE.Quaternion(a[0], a[1], a[2], a[3]);
    } else if (arguments[0] instanceof THREE.Quaternion){
        return arguments[0];
    }
    return undefined;
}

function vecToArray(vec){
    if (vec.w !==undefined){
        return [vec.x, vec.y, vec.z, vec.w];
    }
    return [vec.x, vec.y, vec.z];
}

function arrayToVector(a){
    if (a instanceof THREE.Vector3) return a;
    return Vec3(a[0], a[1], a[2]);
}

function vecToObject(vec){
    //?or use underscore pick
    if (vec.w !==undefined){
        return {x: vec.x, y: vec.y, z: vec.z, w: vec.w};
    }
    return {x: vec.x, y: vec.y, z: vec.z};
}

function castVec3(object, defaults){
    var object = arguments[0];
    for (var i = 1; i < arguments.length; i++){
        object[arguments[i]] = Vec3(object[arguments[i]]);
    }
    return object;
}

function linearTransform(val, minVal, maxVal, minTarget, maxTarget){
    //transforms the interval minVal..maxVal to minTarget..maxTarget
    //y = x * (y1-y0)/(x1-x0) + b; b=y(x=0) with points (x0,y0) x0=minVal x1=maxVal y0=minTarget y1=maxTarget
    try {
        var m = (maxTarget-minTarget)/(maxVal-minVal);
        var b = maxTarget - maxVal * m;
        return val * m + b;
    } catch (e){
        return undefined;
    }
}

