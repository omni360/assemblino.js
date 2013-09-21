
/*
 * This will have functions that run on step simulation and draw canvas
 */
function Program(compiledObject) {
    this.initialTime = Date.now();
    this.init = function () {
    };
    this.step = null;
    this.beforeDraw = null;
    this.afterDraw = null;
    this.keys = {};
    this.mouse = this.keys;
    this.keyDown = {};
    this.keyUp = {};
    this.onTime = {}; //trigger when a certain amount of time passes after construction
    this.compiledObject = null;
    this.compiledCombinations = null;
    if (compiledObject) {
        compiledObject.addProgram(this);
    }
}

Program.prototype.selfDestroy = function () {
    destroyObject(this.keyDown);
    destroyObject(this.keys);
    destroyObject(this.keyUp);
    destroyObject(this);
};

/**
 * compiledCombinations
 *
 * This uses expressions to represent combinations of key presses and releases, and mouse clicks
 * They are in the form "<quantifier><key>(<space><quantifier><key>)*"
 * quantifier is a single character:
 * +: key is being pressed
 * -: key goes up
 * !: key is not being pressed
 * *: mouse is clicked
 * key is the name of the key:
 * {a,b,c,d...,up,left,down,right,shift,space,alt}
 * examples:
 * "+a": trigger when a is being pressed
 * "+a -b": trigger when a is being pressed and b is released
 * "+a +s -space": trigger when both a and s are being pressed and space is released
 * "+a !a": is never triggered
 * "+f !a": trigger when f is pressed, except if a is also being pressed
 * "-up +down": trigger when the up arrow key is released and the arrow down key is being pressed
 * "*part1": part named part1 is clicked
 * "*": canvas was clicked
 */
Program.prototype.compileCombinations = function () {
    this.compiledCombinations = {};
    var _this = this;
    _.keys(this.keys).map(function (key) {
        var compilation = [];
        var quantifier, str;
        var combinations = key.split(/\s/);
        for (var i = 0; i < combinations.length; i++) {
            str = jQuery.trim(combinations[i]);
            if (!str) continue;
            quantifier = str[0];
            str = str.substr(1);
            str || (str = "");
            if (['+', '-', '!', '*'].indexOf(quantifier) > -1) {
                compilation.push([quantifier, str]);
            }
        }
        _this.compiledCombinations[key] = compilation;
    });
};

Program.prototype.matchedCombinations = function (keysDownList, keysUpList, mouseObj) {
    if (!this.compiledCombinations) {
        this.compileCombinations();
    }
    var obj = this.compiledObject;
    var matchedKeys = _.map(this.compiledCombinations, function (combinationList, key) {
        return _.every(combinationList, function (quantifierChar) {
            if (quantifierChar[0] === '+') {
                return keysDownList.indexOf(quantifierChar[1]) > -1;
            } else if (quantifierChar[0] === '-') {
                return keysUpList.indexOf(quantifierChar[1]) > -1;
            } else if (quantifierChar[0] === '!') {
                return keysDownList.indexOf(quantifierChar[1]) < 0;
            } else if (quantifierChar[0] === '*') {
                //no click
                if (mouseObj["*"] === undefined) return false;
                //click on defined object ex:"*myPart", "*mySystem", "*myAssemble"
                if (mouseObj.partKey && mouseObj.partKey === quantifierChar[1]) return true;
                //object is not defined, referring to the self ex:"*" or any part or children contained
                if (mouseObj.partKey && !quantifierChar[1] && (obj.containsPath(mouseObj.partPath) || obj === Assembler.manager.object)) return true;
                //otherwise
                return false;
            } else {
                return false;
            }
        }) && key;
    });
    matchedKeys = _.without(matchedKeys, false);
    return _.values(_.pick(this.keys, matchedKeys));
};

Program.prototype.run = function (event, keysDownList, keysUpList, mouseObj) {
    if (!this.compiledObject) return;
    try {
        var _this = this;
        //init is called before all others
        if (_this.init) {
            _this.init.call(_this.compiledObject);
            _this.init = null;
            return;
        }
        //timed events
        if (!_.isEmpty(_this.onTime)) {
            var now = Date.now() - _this.initialTime;
            _.each(_.keys(_this.onTime), function (time) {
                if (now >= time) {
                    _this.onTime[time].call(_this.compiledObject);
                    delete _this.onTime[time];
                }
            });
        }
        var fun = _this[event];
        if (!fun) return;
        if (event == 'keys') {
            //keys down
            _.map(_this.keyDown, function (keyFun, keyChar) {
                if (keysDownList.indexOf(keyChar) < 0)return;
                keyFun.call(_this.compiledObject);
            });
            //key combinations
            var combis = _this.matchedCombinations(keysDownList, keysUpList, mouseObj);
            combis.length && combis.map(function (f) {
                f.call(_this.compiledObject);
            });
            //keys up
            _.map(_this.keyUp, function (keyFun, keyChar) {
                if (keysUpList.indexOf(keyChar) < 0)return;
                keyFun.call(_this.compiledObject);
            });
        } else {
            //step, draw
            fun.call(_this.compiledObject);
        }
    } catch (e) {
        console.error(e);
        console.log(event);
    }
};

function KeyProgram(object, options){
    var program = new Program(object);

    function increase(low, high, cur, step){
        cur += Number(step);
        return Math.min(cur, high);
    }

    function decrease(low, high, cur, step){
        cur -= Number(step);
        return Math.max(cur, low);
    }

    program.keys['+' + options.increase] = function(){
        var control;
        var parent;
        if (options.parent){
            parent = this.getChild(options.parent);
        } else {
            parent = this;
        }
        control = parent.getController(options.controller);
        var high = control.getHigh();
        var low = control.getLow();
        var cur = 0;
        if (control.settings.actuator=='servo'){
            cur = control.getAngle();
        } else if (control.settings.actuator=='motor'){
            cur = control.getRPM();
        } else if (control.settings.actuator=='linear'){
            cur = control.getPosition();
        }
        cur = increase(low, high, cur, options.step || (high-low)/90);
        if (control.settings.actuator=='servo'){
            control.setAngle(cur);
        } else if (control.settings.actuator=='motor'){
            control.setRPM(cur);
        } else if (control.settings.actuator=='linear'){
            control.setPosition(cur);
        }
    };

    program.keys['+' + options.decrease] = function(){
        var control;
        var parent;
        if (options.parent){
            parent = this.getChild(options.parent);
        } else {
            parent = this;
        }
        control = parent.getController(options.controller);
        var high = control.getHigh();
        var low = control.getLow();
        var cur = 0;
        if (control.settings.actuator=='servo'){
            cur = control.getAngle();
        } else if (control.settings.actuator=='motor'){
            cur = control.getRPM();
        } else if (control.settings.actuator=='linear'){
            cur = control.getPosition();
        }
        cur = decrease(low, high, cur, options.step || (high-low)/90);
        if (control.settings.actuator=='servo'){
            control.setAngle(cur);
        } else if (control.settings.actuator=='motor'){
            control.setRPM(cur);
        } else if (control.settings.actuator=='linear'){
            control.setPosition(cur);
        }
    };
}

function KeyWheelsProgram(object, options){
    //stop wheels
    var program = new Program(object);

    function setRPM(f1, f2){
        var m1 = this.getController(options.left);
        var m2 = this.getController(options.right);
        m1.setRPM(f1 * m1.getLow());
        m2.setRPM(f2 * m2.getHigh());
    }

    program.keys['-up'] = program.keys['-down'] = function(){
        setRPM.call(this, 0, 0);
    };

//go forward
    program.keys['+up !left !right'] = function(){
        setRPM.call(this, 1, 1);
    };

//turn left, forward
    program.keys['+up +left'] = function(){
        setRPM.call(this, 0.5, 1);
    };

//turn right, forward
    program.keys['+up +right'] = function(){
        setRPM.call(this, 1, 0.5);
    };

//go backwards
    program.keys['+down !left !right'] = function(){
        setRPM.call(this, -1, -1);
    };

//turn left, backwards
    program.keys['+down +left'] = function(){
        setRPM.call(this, -0.5, -1);
    };

//turn right, backwards
    program.keys['+down +right'] = function(){
        setRPM.call(this, -1, -0.5);
    };
}


function KeyGripperProgram(object, options){
    var program = new Program(object);
    function increase(low, high, cur, step){
        cur += step;
        return Math.min(cur, high);
    }
    function decrease(low, high, cur, step){
        cur -= step;
        return Math.max(cur, low);
    }
    program.keys['+' + options.open] = function(){
        var grip = this.getChild(options.gripper);
        var low = grip.getMinimum();
        var high = grip.getMaximum();
        var cur = grip._distance!==undefined ? grip._distance: high;
        cur = increase(low, high, cur, options.step || (high-low)/30);
        grip._distance = cur;
        grip.setDistance(cur);
    };
    program.keys['+' + options.close] = function(){
        var grip = this.getChild(options.gripper);
        var low = grip.getMinimum();
        var high = grip.getMaximum();
        var cur = grip._distance!==undefined ? grip._distance: high;
        cur = decrease(low, high, cur, options.step || (high-low)/30);
        grip._distance = cur;
        grip.setDistance(cur);
    };
}