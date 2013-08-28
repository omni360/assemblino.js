'use strict';

//Solvinf deprecated issues with THREE.js

THREE.Vector3.prototype.subSelf = THREE.Vector3.prototype.sub;
THREE.Vector3.prototype.addSelf = THREE.Vector3.prototype.add;

//Underscore.js hack
_.clonex = function(obj, ext){
    //clone and extend object
    return _.extend(_.clone(obj || {}), ext||{});
};

//ThreeCSG  hack

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


//dat.GUI hacks

dat.GUI.prototype.getController = function (name, recursive) {
    for (var i = 0; i < this.__controllers.length; i++) {
        if (this.__controllers[i].property == name) {
            return this.__controllers[i];
        }
    }
    var res = null;
    if (recursive) {
        _.map(this.__folders, function (folder) {
            res = res || folder.getController(name, recursive);
        });
    }
    return res;
};

dat.GUI.prototype.removeController = function (name, recursive) {
    var c = this.getController(name);
    if (c) this.remove(c);
    recursive && _.map(this.__folders, function (folder) {
        folder.removeController(name, recursive);
    });
};

dat.GUI.prototype.toggleController = function (name, show, recursive) {
    var c = this.getController(name);
    if (c) {
        var opera = show ? 'show' : 'hide';
        $(c.__li)[opera]();
    }
    recursive && _.map(this.__folders, function (folder) {
        folder.toggleController(name, show, recursive);
    });
};

dat.GUI.prototype.getValue = function (name) {
    var controller = this.getController(name);
    if (controller) {
        return controller.getValue();
    }
    return undefined;
};

dat.GUI.prototype.setValue = function (name, value) {
    var controller = this.getController(name);
    if (controller) {
        return controller.setValue(value);
    }
    return undefined;
};

dat.GUI.prototype.fireButton = function (name) {
    var controller = this.getController(name);
    if (controller) {
        controller.fire();
    }
};

dat.GUI.prototype.getFolder = function (name) {
    return this.__folders[name];
};

dat.GUI.prototype.collapseTree = function (untilLevel, currentLevel) {
    currentLevel || (currentLevel = 0);
    if (untilLevel && untilLevel < currentLevel) {
        return;
    }
    this.close();
    _.map(this.__folders, function (folder) {
        folder.collapseTree(untilLevel, ++currentLevel);
    });
};

dat.GUI.prototype.removeFolder = function (name, log) {
    var folder = this.getFolder(name);
    if (!folder) return;
    log && console.log("removeFolder: " + name);
    folder.clear(log);
    $(folder.domElement).remove();
    delete this.__folders[name];
};

dat.GUI.prototype.clear = function (log) {
    log && console.log("clear:");
    log && console.log(this);
    this.onClick && this.onClick(null);
    var cpy = this.__controllers.slice();
    while (cpy.length) {
        try {
            cpy[0].remove();
        } catch (e) {
            log && console.error(e);
            log && console.log(cpy[0].property);
        }
        cpy.shift();
    }
    var _this = this;
    _.each(_.keys(this.__folders), function (i) {
        _this.removeFolder(i, log);
    });
};


//brain.js hack

brain.NeuralNetwork.prototype.addTrainingCase = function(input, output) {
    this.list || (this.list = []);
    this.list.push({
        input: input,
        output: output
    });
};

brain.NeuralNetwork.prototype.normalize = function(list, boundaries) {
    //normalises values in the list of training cases (hash form)
    list = _.shuffle(list || this.list || []);
    boundaries = boundaries || this.boundaries || {};
    if (!list.length) {
        throw "Training cases list is empty.";
    }
    var inputMin = _.extend({}, list[0].input);
    var inputMax = _.extend({}, list[0].input);
    var outputMin = _.extend({}, list[0].output);
    var outputMax = _.extend({}, list[0].output);
    _.map(_.keys(inputMin), function (key) {
        _.each(list, function (tc) {
            inputMin[key] = Math.min(tc.input[key], inputMin[key]);
            inputMax[key] = Math.max(tc.input[key], inputMax[key]);
        });
    });
    _.map(_.keys(outputMin), function (key) {
        _.each(list, function (tc) {
            outputMin[key] = Math.min(tc.output[key], outputMin[key]);
            outputMax[key] = Math.max(tc.output[key], outputMax[key]);
        });
    });
    _.map(_.keys(inputMin), function (key) {
        _.each(list, function (tc) {
            tc.input[key] = linearTransform(tc.input[key], inputMin[key], inputMax[key], 0, 1);
        });
    });
    _.map(_.keys(outputMin), function (key) {
        _.each(list, function (tc) {
            tc.output[key] = linearTransform(tc.output[key], outputMin[key], outputMax[key], 0, 1);
        });
    });
    _.extend(boundaries, {
        inputMin: inputMin,
        inputMax: inputMax,
        outputMin: outputMin,
        outputMax: outputMax
    });
    this.list = list;
    this.boundaries = boundaries;
    return list;
};

brain.NeuralNetwork.prototype.transcode = function(input) {
    //encode input, run trough neural net, and decode output
    return this.decode(this.run(this.encode(input)));
};

brain.NeuralNetwork.prototype.encode = function(input) {
    var boundaries = this.boundaries;
    input = _.clone(input);
    _.map(input, function(value, key){
        if ((boundaries.inputMin[key]===undefined)||(boundaries.inputMax[key]===undefined)) {throw "Input " + key + " is not bounded."};
        input[key]= linearTransform(value, boundaries.inputMin[key], boundaries.inputMax[key], 0, 1);
    });
    return input;
};

brain.NeuralNetwork.prototype.decode = function(output) {
    var boundaries = this.boundaries;
    output = _.clone(output);
    _.map(output, function(value, key){
        if ((boundaries.outputMin[key]===undefined)||(boundaries.outputMax[key]===undefined)) {throw "Output " + key + " is not bounded."};
        output[key]= linearTransform(value, 0, 1, boundaries.outputMin[key], boundaries.outputMax[key]);
    });
    return output;
};

brain.NeuralNetwork.prototype.decodeInput = function(input) {
    var boundaries = this.boundaries;
    input = _.clone(input);
    _.map(input, function(value, key){
        if ((boundaries.inputMin[key]===undefined)||(boundaries.inputMax[key]===undefined)) {throw "Input " + key + " is not bounded."};
        input[key]= linearTransform(value, 0, 1, boundaries.inputMin[key], boundaries.inputMax[key]);
    });
    return input;
};

brain.NeuralNetwork.prototype.logProgression = function(limit) {
    var log;
    if (!this.list || !this.list.length) return log;
    var step = Math.max(1, Math.round(limit / 100));
    if ((this.list.length % step) == 0) {
        if (this._lastLog === this.list.length) return;
        this._lastLog = this.list.length;
        log = Math.round(100 * this.list.length / limit) + " %";
        console.log(log);
    }
    return log;
};

brain.NeuralNetwork.prototype.hasEnoughData = function(limit){
    return this.list && (this.list.length >= limit);
};

brain.NeuralNetwork.prototype.saveNetwork = function(){
    Assemblino.manager.setData('brainObject', this.toJSON());
    Assemblino.manager.setData('brainBoundaries', this.boundaries);
};

brain.NeuralNetwork.prototype.loadNetwork = function(){
    var weights = Assemblino.manager.getData('brainObject');
    var boundaries = Assemblino.manager.getData('brainBoundaries');
    if (!weights || !boundaries) return false;
    this.fromJSON(weights);
    this.boundaries = boundaries;
    return true;
};
