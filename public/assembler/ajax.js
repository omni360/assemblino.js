'use strict';

function httReq(callback){
    var req;
    if (window.XMLHttpRequest) {
        req = new XMLHttpRequest();
    } else {
        req = new ActiveXObject("Microsoft.XMLHTTP");
    }
    req.onreadystatechange=function() {
        if (this.readyState==4) {
                if ( this.status==200) {
                        callback && callback(this.responseText);
                } else {
                        console.log("ajax error, status: " + this.status);
                }
        }
    };
    return req;
}

function postRequest (uri,jsonObj, callback) {
    try {
        var req = httReq(callback);
        req.open("POST", '/ajax'+uri, true);
        req.setRequestHeader("Content-type","application/json");
        req.send(JSON.stringify(jsonObj));
    } catch (e) {
        notify(e);
    }
}

/**
 * Not a socket :) but this will do for now
 */
function socketRequest (uri,jsonObj, callback) {
    var delta = 200;
    function check(resp){
        var obj = JSON.parse(resp);
        if (obj.status==='repeat'){
            delta *= 1.33; //increase the interval slowly
            setTimeout(function(){
                postRequest(uri, jsonObj, check);
            },Math.round(delta + 50*Math.random()));
        } else {
            callback && callback(resp);
        }
    }
    postRequest(uri, jsonObj, check);
}