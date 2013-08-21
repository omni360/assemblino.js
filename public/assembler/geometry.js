'use strict';

THREE.Vector3.prototype.subSelf = THREE.Vector3.prototype.sub;
THREE.Vector3.prototype.addSelf = THREE.Vector3.prototype.add;

_.clonex = function(obj, ext){
     return _.extend(_.clone(obj || {}), ext||{});
};

(function () {
    function csgOperation(c1, c2, operation) {
        var bsp1 = new ThreeBSP(c1);
        var bsp2 = new ThreeBSP(c2);
        var resultBsp = bsp1[operation](bsp2);
        return resultBsp.toGeometry();
    }

    ["union", "intersect", "subtract"].map(
        function (operation) {
            THREE.Geometry.prototype[operation] = function (other) {
                return csgOperation(this, other, operation);
            }
        });
})();


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
    try {
        var m = (maxTarget-minTarget)/(maxVal-minVal);
        var b = maxTarget - maxVal * m;
        return val * m + b;
    } catch (e){
        return undefined;
    }
}
