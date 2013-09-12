'use strict';

var _auxMatrix4 = new THREE.Matrix4();

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

function Part(options) {
    this.objectType = 'Part';
    this.isCompiled = true;
    this.settings = {}; //init
    this.settings.name = "id" + nextInt(); //init
    this.path = [this.settings.name];
    this.mesh = null;
    this.connectors = [];
    this.programs = [];
    this.dependencies = [];
    this.centerConnector = null;
    this.databaseName = "";
    options && this.addBody(options);
    return this;
}


Part.prototype.selfDestroy = function () {
    while (this.programs.length) {
        this.programs.pop().selfDestroy();
    }
    while (this.connectors.length) {
        this.connectors.pop().selfDestroy();
    }
    destroyObject(this.settings);
    destroyObject(this);
};

Part.prototype.addProgram = function (program) {
    if (program) {
        if (this.programs.indexOf(program) >= 0) {
            return;
        }
        program.compiledObject = this;
        this.programs.push(program);
    }
};

Part.prototype.getConnector = function (key) {
    if (this.connectors[key]) {
        return this.connectors[key];
    } else {
        for (var i = 0; i < this.connectors.length; i++) {
            if (this.connectors[i].getName() === key) {
                return this.connectors[i];
            }
        }
    }
    return undefined;
};

Part.prototype.isConnected = function () {
    for (var i = 0; i < this.connectors.length; i++) {
        if (this.connectors[i].isConnected) {
            return true;
        }
    }
    return false;
};

Part.prototype.getSettings = function () {
    if (arguments[0]) {
        return (this.settings || this.options)[arguments[0]];
    }
    return this.settings || this.options;
};

Part.prototype.setSettings = function () {
    if (!arguments[0]) {
        return;
    } else if (arguments.length > 1) {
        this.settings[arguments[0]] = arguments[1];
    } else {
        this.settings = arguments[0];
    }
    this.path = [this.settings.name];
};

Part.prototype.extendOptions = function (options) {
    options && _.extend(this.settings, options);
};

Part.prototype.getOptions = Part.prototype.getSettings;
Part.prototype.setOptions = Part.prototype.setSettings;

Part.prototype.setName = function (value) {
    this.settings.name = value;
    this.path = [value];
    return value;
};

Part.prototype.getName = function () {
    return this.settings.name;
};

/*
 Path has information about the hierarchy, the parents
 Should be used to identify the part in composite systems and assembles
 */
Part.prototype.setPath = function (value) {
    this.path = value;
    return value;
};

Part.prototype.getPath = function () {
    return this.path;
};

Part.prototype.getKey = function () {
    return this.path && this.path.join('/') || this.getName();
};

Part.prototype.prependToPath = function (value) {
    if (value && this.path[0] != value) this.path.unshift(value);
};

Part.prototype.hasParent = function () {
    return this.path.length > 1;
};

Part.prototype.rootParentName = function () {
    return this.path[0];
};

Part.prototype.containsPath = function (path) {
    //it has the same mechanics as checking if a file belongs to a folder
    //return true if for ex this.path == "system/sys2" and path=="system/sys2/part1"
    //return false if for ex this.path == "system/sys2" and path=="system/sys3/part1"
    for (var i = 0; i < this.path.length; i++) {
        if (path[i] !== this.path[i]) return false;
    }
    return true;
};

Part.prototype.addToScene = function (simulator, callback) {
    if (!this.mesh) return;
    var _this = this;
    var count = 0; //keeps track of the quantity of parts and constraints
    var scene = sceneOf(simulator);
    if (!this.centerConnector) {
        this.centerConnector = new Connector({
            //name: nextName("-"),
            opacity: 0.0,
            accept: [],
            showAxis: false,
            touchable: false
        });
        this.add(this.centerConnector);
    }
    function addMyPrograms() {
        count--;
        if (count > 0) return; //if some object is not ready
        _this.mesh && _this.mesh.removeEventListener('ready', addMyPrograms);
        _this.connectors.map(function (c) {
            if (c.controller) {
                count++;
                c.controller.removeEventListener("constraintReady", addMyPrograms);
            }
        });
        _this.programs.map(
            function (p) {
                simulator.programs.push(p);
            }
        );
        _this.mesh.dispatchEvent('programsEnabledToRun');
        callback && callback();
    }

    this.scene = scene;
    if (this.mesh) { //FIXME parts without meshes? is that possible?
        count++;
        this.mesh.addEventListener("ready", addMyPrograms);
        scene.add(this.mesh);
    }
    simulator.connectors = simulator.connectors.concat(this.connectors);
    this.connectors.map(function (c) {
        c.visible(simulator.showConnectors);
        if (c.controller && !c.controller.constraintReady) {
            count++;
            c.controller.addEventListener("constraintReady", addMyPrograms);
        }
    });
};

/*
Part.prototype.removeFromScene = function () {
    this.scene.remove(this.mesh);
    if (this.connectors.length > 0) {
        for (var i = 0; i < this.connectors.length; i++) {
            this.connectors[i].selfDestroy();
        }
        this.scene.connectors = _.difference(this.scene.connectors, this.connectors);
    }
    this.selfDestroy();
};
*/

Part.prototype.setPhysics = function (options) {
    //sets position, rotation, linear and angular velocities
    var mesh = this.mesh;
    mesh.__dirtyPosition = true;
    mesh.__dirtyRotation = true;
    options.position && mesh.position.copy(Vec3(options.position));
    if (options.rotation) {
        //mesh.rotation.copy(Vec3(options.rotation));
        _auxMatrix4.identity().makeRotationFromEuler(Vec3(options.rotation), 'XYZ');
        mesh.quaternion.setFromRotationMatrix(_auxMatrix4);
    }
    options.quaternion && mesh.quaternion.copy(Vec4(options.quaternion));
    //linear and angular should be set when part is ready
    options.linear && mesh.setLinearVelocity(Vec3(options.linear));
    options.angular && mesh.setAngularVelocity(Vec3(options.angular));
};

Part.prototype.getPhysics = function () {
    //get position, rotation, linear and angular velocities
    var mesh = this.mesh;
    mesh.updateMatrixWorld(true);
    var ret = {};
    ret.position = mesh.position.clone();
    ret.quaternion = mesh.quaternion.clone();
    //ret.linear = mesh.getLinearVelocity();
    //ret.angular = mesh.getAngularVelocity();
    //convert to arrays
    _.keys(ret).map(function (key) {
        ret[key] = vecToArray(ret[key]);
    });
    return ret;
};

Part.prototype.getPosition = function () {
    return this.mesh.position.clone();
};

Part.prototype.setPosition = function (position) {
    this.setPhysics({position: position});
};

Part.prototype.add = function (body, options) {
    var _this = this;
    options = options || {};
    if (body instanceof THREE.Mesh) {
        if ((options.visible !== undefined) && !options.visible) {
            body.material.visible = false;
        } else if (RENDER_SHADOWS) {
            body.castShadow = true;
            body.receiveShadow = true;
        }
        body.removable = true;
        if (body instanceof Physijs.Mesh) {
            if (this.mesh) {
                this.mesh.add(body);
            } else {
                this.mesh = body;
                body.part = this;
                _this.isReady = false;
                body.addEventListener('ready', function () {
                    _this.isReady = true;
                    _this.scene && _this.scene.execute("setCcdMotionThreshold", {threshold: 0.5, id: _this.mesh._physijs.id});
                    _this.scene && _this.scene.execute("setCcdSweptSphereRadius", {radius: 0.5, id: _this.mesh._physijs.id});
                    //TODO damping should be a property also dependant on the scenario
                    var linear_amount = 0.25;
                    var angular_amount = 0.25;
                    _this.scene && body.setDamping(linear_amount, angular_amount);
                    _this.scene && body.removeEvent('ready');

                });
            }
            body.geometry.computeBoundingSphere();
        } else {
            if (this.mesh) {
                this.mesh.add(body);
            } else {
                this.mesh = body;
            }
        }
    } else if (body instanceof Connector) {
        this.connectors.push(body);
        body.mesh.removable = true;
        body.mesh.isConnector = true;
        body.parentPart = this;
        this.mesh.add(body.mesh);
        var _thisMesh = this.mesh;
        this.mesh.addEventListener('ready', function () {
            body.dispatchEvent('objectReady');
            body.removeEvent('objectReady');
            _thisMesh.removeEvent('ready');
        });
    } else if ((body instanceof Part) && !this.mesh) {
        this.mesh = body.mesh;
        this.connectors = body.connectors;
    } else if (body instanceof Part) {
        //if the body has connectors and its a Part then assume its connectors
        body.mesh.updateMatrixWorld(true);
        _auxMatrix4.copy(body.mesh.matrixWorld);
        _.map(body.connectors, function (c) {
            c.parentPart.mesh.remove(c);
            //connectors base and position need to be translated,
            //because they are initially set with the original parent's referential
            if (_this.mesh !== body.mesh) {
                c.mesh.applyMatrix(_auxMatrix4);
                c.mesh.updateMatrixWorld(true);
                body.mesh.localToWorld(c.base);
                c.up.transformDirection(_auxMatrix4);
                c.front.transformDirection(_auxMatrix4);
                _.extend(c.options,_.pick(c, ['base','up','front']));
            }
            _this.add(c);
        });
        _this.add(body.mesh);
        while(body.connectors.length){
            body.connectors.pop();
        }

    } else if (body instanceof THREE.Object3D) {
        try {
            _this.mesh.add(body);
        } catch (e) {
            console.log('error adding to part:');
            console.log(body);
        }
    } else {
        console.log('not added to part:');
        console.log(body);
    }
    return body;
};

Part.prototype.removeConnectorsExcept = function (except) {
    except || (except = []);
    if (except instanceof Array){
    } else {
        except = [except];
    }
    var connectors = [];
    var c;
    while (this.connectors.length){
        connectors.push(this.connectors.shift());
    }
    while (connectors.length){
        c = connectors.shift();
        if (except.indexOf(c.getName())<0){
            this.mesh.remove(c.mesh);
            c.selfDestroy();
        } else {
            this.connectors.push(c);
        }
    }
};

Part.prototype.addConnector = function (options) {
    options || (options = {});
    var conn = new Connector(options);
    this.add(conn);
    return conn;
};

Part.prototype.addBody = function (options) {
    if (options instanceof Physijs.Mesh) {
        this.add(options);
        return options;
    }
    options || (options = {});
    options.collide = true;
    return this.addMesh(options);
};

Part.prototype.addDress = function (options) {
    if (options instanceof THREE.Mesh) {
        this.add(options);
        return options;
    }
    options || (options = {});
    options.collide = false;
    return this.addMesh(options);
};


Part.prototype.addMesh = function (options) {
    var geo, cons, material, mesh, position, rotation;
    options || (options = {});
    if (!this.mesh) {
        options.collide = true;
    }
    if (options.scale) {
        options.scale = Vec3(options.scale, options.scale, options.scale);
    } else {
        options.scale = Vec3(1, 1, 1);
    }
    if (options.name) {
        this.setName(options.name);
    }
    var shape = {
        cube: 'box',
        ball: 'sphere'
    }[options.shape] || options.shape || 'box';
    switch (shape) {
        case 'box':
            options.segments || (options.segments = 1);
            options.width = options.width || options.size || 1;
            options.height = options.height || options.size || 1;
            options.depth = options.depth || options.size || 1;
            geo = new THREE.CubeGeometry(
                options.width,
                options.height,
                options.depth,
                options.widthSegments || options.segments,
                options.heightSegments || options.segments,
                options.depthSegments || options.segments);
            cons = Physijs.BoxMesh;
            break;
        case 'sphere':
            options.segments || (options.segments = 16);
            !options.radius && (options.radius = (options.diameter || options.size || 1) / 2);
            geo = new THREE.SphereGeometry(
                options.radius,
                options.widthSegments || options.segments,
                options.heightSegments || options.segments);
            cons = Physijs.SphereMesh;
            break;
        case 'cylinder':
            options.segments || (options.segments = 16);
            !options.radius && (options.radius = (options.diameter || options.size || 1) / 2);
            !options.radiusTop && (options.radiusTop = options.radius);
            !options.radiusBottom && (options.radiusBottom = options.radius);
            !options.height && (options.height = options.size || 1);
            geo = new THREE.CylinderGeometry(
                options.radiusTop,
                options.radiusBottom,
                options.height,
                options.radiusSegments || options.segments,
                options.heightSegments || 1,
                options.openEnded);
            cons = Physijs.CylinderMesh;
            break;
        case 'cone':
            !options.radius && (options.radius = (options.diameter || options.size || 1) / 2);
            !options.height && (options.height = options.size || 1);
            geo = new THREE.CylinderGeometry(
                0,
                options.radius,
                options.height,
                options.radiusSegments || options.segments || 16,
                options.heightSegments || 1);
            cons = Physijs.ConeMesh;
            break;
        case 'convex':
            var vertices = options.vertices || [];
            options.size || ( options.size = 1);
            options.numVertices = Math.max(options.numVertices || 0, 4);
            while (vertices.length < options.numVertices) {
                vertices.push([
                    Math.random() * options.size - options.size / 2,
                    Math.random() * options.size - options.size / 2,
                    Math.random() * options.size - options.size / 2
                ]);
            }
            vertices = vertices.map(arrayToVector);
            geo = new THREE.ConvexGeometry(vertices);
            cons = Physijs.ConvexMesh;
            break;
    }
    material = new Material(options);
    position = Vec3(options.position || [0, 0, 0]);
    _.extend(position, _.pick(options, 'x', 'y', 'z'));

    if (options.collide) {
        mesh = new cons(geo, material, options.mass === undefined ? 1 : options.mass);
    } else {
        mesh = new THREE.Mesh(geo, material);
    }
    if (options.referential == 'absolute' && this.mesh) {
        position.sub(this.mesh.position);
    }
    mesh.scale.copy(options.scale);
    mesh.position.copy(position);

    if (options.rotation || options.rx || options.ry || options.rz) {
        rotation = Vec3(options.rotation || [0, 0, 0]);
        options.rx && (rotation.x = options.rx);
        options.ry && (rotation.y = options.ry);
        options.rz && (rotation.z = options.rz);
        _auxMatrix4.identity().makeRotationFromEuler(rotation, 'XYZ');
        mesh.quaternion.setFromRotationMatrix(_auxMatrix4);
    }
    return this.add(mesh, options);
};

Part.prototype.avoidCollisionWith = function (other) {
    this.setCollisionMask(2, 2);
    other.setCollisionMask(1, 1);
};

Part.prototype.setCollisionMask = function (group, mask) {
    if (mask === undefined) {
        mask = group;
    }
    this.mesh._physijs.collision_masks = [group, mask];
};


Part.prototype.addGUIController = function (){
    return Assemblino.menus.addObjectGUI(this, arguments);
};

function System() {
    this.isCompiled = true;
    this.objectType = "System";
    this.settings = {}; //init
    this.settings.name = "id" + nextInt(); //init
    this.path = [this.settings.name]; //init
    this.children = [];
    this.parts = [];
    this.constraints = [];
    this.controllers = [];
    this.programs = [];
    this.databaseName = "";
}

//get some methods from Part
_.extend(System.prototype, _.pick(Part.prototype, [
    'setName', 'getName', 'getKey' , 'setPath', 'getPath', 'containsPath', 'setSettings',
    'getSettings', 'getOptions', 'setOptions', 'extendOptions', 'addProgram','addGUIController']
));

System.prototype.selfDestroy = function () {
    while (this.programs.length) {
        this.programs.pop().selfDestroy();
    }
    while (this.children.length) {
        this.children.pop().selfDestroy();
    }
    while (this.parts.length) {
        //this destroys also constraints and controllers
        this.parts.pop().selfDestroy();
    }
    while (this.controllers.length) {
        this.controllers.pop();
    }
    while (this.constraints.length) {
        this.constraints.pop();
    }
    destroyObject(this);
};

System.prototype.makeKey = function (declaration, name) {
    if (declaration.path && declaration.path instanceof Array) {
        return declaration.path.join("/");
    } else {
        return declaration.name || name;
    }
};

System.prototype.insert = function (name, constructor, options) {
    options = _.clone(options || {});
    options['name'] = name;
    var obj = Assembler.objects[constructor];
    if (obj) {
        obj = obj(options);
        this.add(obj);
        return obj;
    } else {
        return null;
    }
};

System.prototype.setPhysics = function (part, options) {
    part = this.getPartByName(part);
    if (part) part.setPhysics(options);
};

System.prototype.join = System.prototype.connect = function (options, controllerOptions) {
    options.fixed = this.getPartByName(options.fixed);
    options.moved = this.getPartByName(options.moved);
    connect(options, controllerOptions, this);
};

System.prototype.prependToPath = function (toPrepend) {
    if (!toPrepend) return;
    //if (this.path[0] != toPrepend) this.path.unshift(toPrepend);
    _.each(this.partsList(), function (p) {
        p.prependToPath(toPrepend);
    });
    _.each(this.children, function (c) {
        c.prependToPath(toPrepend);
    });
};

System.prototype.addToScene = function (scene2, callback, track) {
    track || (track = {count: 0});
    function activateProgram() {
        track.count--;
        if (track.count == 0) {
            callback && callback();
        }
        this.mesh && this.mesh.removeEvent('programsEnabledToRun');
        !this.mesh && this.removeEventListener('constraintReady', activateProgram);
    }

    this.parts.map(
        function (part) {
            track.count++;
            part.mesh.addEventListener('programsEnabledToRun', activateProgram);
            part.addToScene(scene2);
        }
    );
    //programs should be already compiled
    this.programs.map(
        function (p) {
            scene2.programs.push(p);
        }
    );
    var _this = this;
    this.scene = sceneOf(scene2);
    this.controllers.map(
        function (controller) {
            var constraint = controller.addToScene(scene2);
            controller.system = _this;
            _this.constraints.push(constraint);
            track.count++;
            controller.addEventListener('constraintReady', activateProgram);
        }
    );
    _.map(this.children,
        function (child) {
            child.addToScene(scene2, callback, track);
        }
    );
};

System.prototype.add = function (component, databaseName) {
    databaseName && (component.databaseName = databaseName);
    if (component instanceof Part) {
        this.parts.push(component);
    } else if (component instanceof System) {
        component.prependToPath(component.getName());
        this.children.push(component);
    } else if (component instanceof Assemble) {
        if (!component.isCompiled) {
            component = component.compile();
        }
        component.prependToPath(component.getName());
        this.children.push(component);
    }
};

System.prototype.addController = function (controller) {
    this.controllers.push(controller);
    return controller;
};

System.prototype.getController = function (name) {
    for (var i = 0; i < this.controllers.length; i++) {
        if (this.controllers[i].settings && this.controllers[i].settings.name == name) {
            return this.controllers[i];
        }
    }
    var control = undefined;
    for (var j = 0; j < this.children.length; j++) {
        control || (control = this.children[j].getController(name));
    }
    return control;
};

System.prototype.getPart = function (name) {
    for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].getKey() === name || this.parts[i].getName() === name) {
            return this.parts[i];
        }
    }
    var part = undefined;
    for (var j = 0; j < this.children.length; j++) {
        part || (part = this.children[j].getPart(name));
    }
    return part;
};

System.prototype.getPartByKey = function (key, recursive) {
    for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].getKey() === key) {
            return this.parts[i];
        }
    }
    if (!recursive) return undefined;
    var part = undefined;
    for (var j = 0; j < this.children.length; j++) {
        part || (part = this.children[j].getPartByKey(key, recursive));
    }
    return part;
};

System.prototype.getPartByName = function (name, recursive) {
    for (var i = 0; i < this.parts.length; i++) {
        if (this.parts[i].getName() === name) {
            return this.parts[i];
        }
    }
    if (!recursive) return undefined;
    var part = undefined;
    for (var j = 0; j < this.children.length; j++) {
        part || (part = this.children[j].getPartByName(name, recursive));
    }
    return part;
};

System.prototype.getChildByKey = function (key, recursive) {
    var i, j;
    for (i = 0; i < this.parts.length; i++) {
        if (this.parts[i].getKey() === key) {
            return this.parts[i];
        }
    }
    var part = undefined;
    for (j = 0; j < this.children.length; j++) {
        if (this.children[j].getKey() === key) {
            return this.children[j];
        }
    }
    if (!recursive) return part;
    for (j = 0; j < this.children.length; j++) {
        part || (part = this.children[j].getPartByKey(key, recursive));
    }
    return part;
};

System.prototype.getChild = function (name, recursive) {
    var i, j;
    for (i = 0; i < this.parts.length; i++) {
        if (this.parts[i].getName() === name) {
            return this.parts[i];
        }
    }
    for (j = 0; j < this.children.length; j++) {
        if (this.children[j].getName() === name) {
            return this.children[j];
        }
    }
    if (!recursive) return undefined;
    var part = undefined;
    for (j = 0; j < this.children.length; j++) {
        part || (part = this.children[j].getChildByName(name, recursive));
    }
    return part;
};

/*
 List all parts and those of the children
 */
System.prototype.partsList = function (list) {
    list || ( list = []);
    for (var i = 0; i < this.parts.length; i++) {
        list.push(this.parts[i]);
    }
    for (var j = 0; j < this.children.length; j++) {
        this.children[j].partsList(list);
    }
    return list;
};

function Assemble() {
    this.isCompiled = false;
    this.objectType = "Assemble";
    this.settings = {}; //init
    this.settings.name = "id" + nextInt(); //init
    this.path = [this.settings.name]; //init
    this.children = [];
    this.parts = [];
    this.constraints = [];
    this.controllers = [];
    this.programs = [];
    this.databaseName = "";
    this.content = this.newContent();
}

Assemble.prototype.codeName = "ASSEMBLE";

//get some methods from Part
_.extend(Assemble.prototype, _.pick(Part.prototype, [
    'setName', 'getName', 'getKey' , 'setPath', 'getPath', 'containsPath', 'setSettings',
    'getSettings', 'getOptions', 'setOptions', 'extendOptions', 'addProgram'
]));

//get some methods from System
_.extend(Assemble.prototype, _.pick(System.prototype, [
    'selfDestroy', 'makeKey', 'setPhysics', 'join', 'connect', 'prependToPath', 'addToScene', 'add',
    'addController', 'getController', 'getPart', 'getPartByKey', 'getPartByName', 'getChildByKey', 'partsList', 'getChild',
    'addGUIController'
]));

Assemble.prototype.newContent = function (replace) {
    var content = {
        options: {},
        declarations: {},
        physics: {},
        connections: [],
        connectorOptions: [],
        programs: [],
        isCompiled: false
    };
    if (replace) {
        this.content = content;
    }
    return content;
};

Assemble.prototype.optionsCode = function (options) {
    return "\n" + this.codeName + ".setOptions(_.extend(" + JSON.stringify(options) + ",arguments[0]||{}));"
};

Assemble.prototype.declarationCode = function (name, object, options) {
    return "__D3f5['" + name + "'] = Assemblino.get('" + object + "'," + JSON.stringify(options) + ");" +
        "\n" + this.codeName + ".add(__D3f5['" + name + "'],'" + object + "');";
};

Assemble.prototype.physicCode = function (name, options) {
    return "(" + this.codeName + ".getPartByKey('" + name + "',true)||__D3f5).setPhysics(" + JSON.stringify(options) + ");";
};

Assemble.prototype.connectCode = function (options) {
    var _this = this;
    var opt = "{" + ["moved", "fixed", "movedIndex", "fixedIndex"].map(function (par) {
        return "\"" + par + "\": " + (par.match("Index") ? "\"" + options[par] + "\"" : _this.codeName + ".getPartByKey('" + options[par] + "',true)");
    }).join(", ") + "}";
    var controllerOptions = ", {}";
    if (options.controllerOptions) {
        controllerOptions = ", " + JSON.stringify(options.controllerOptions);
    }
    return this.codeName + ".connect(" + opt + "" + controllerOptions + ");";
};

Assemble.prototype.connectStateCode = function (args) {
    return this.codeName + ".overControllerState('" + args[0] + "','" + args[1] + "'," + JSON.stringify(args[2]) + ");";
};

Assemble.prototype.contentToCode = function () {
    var _this = this;
    var options = this.optionsCode(this.content.options || {});
    var declarations = _.reduce(_.pairs(this.content.declarations),
        function (memo, pair) {
            var name = pair[0];
            var object = pair[1].object;
            var options = pair[1].options;
            return memo + _this.declarationCode(name, object, options) + "\n";
        }, "");
    var physics = _.reduce(_.pairs(this.content.physics),
        function (memo, pair) {
            var name = pair[0];
            var options = pair[1];
            return memo + _this.physicCode(name, options) + "\n";
        }, "");
    var connections = _.reduce(this.content.connections,
        function (memo, options) {
            return memo + _this.connectCode(options) + "\n";
        }, "");
    var states = _.reduce(this.content.connectorOptions || [],
        function (memo, args) {
            return memo + _this.connectStateCode(args) + "\n";
        }, "");
    return "var " + this.codeName + " = new Assemble();" +
        "\n" + options +
        "\n" + "var __D3f5={setPhysics: _.identity};" +
        "\n" + declarations +
        "\n" + physics +
        "\n" + connections +
        "\n" + states +
        "\nreturn " + this.codeName + ";\n";
};

Assemble.prototype.contentAsCode = function () {
    return "var " + this.codeName + " = new Assemble();" +
        "\n" + this.codeName + ".content = " + JSON.stringify(this.content) + ";" +
        "\n" + this.codeName + ".setOptions(_.extend(" + JSON.stringify(this.content.options || {}) + ",arguments[0]||{}));" +
        //"\nconsole.log(arguments);" +
        //"\nconsole.log(" + this.codeName + ".settings);" +
        "\n" + "return " + this.codeName + ";";
};

Assemble.prototype.compile = function (program) {
    var code = this.contentToCode();
    var assemble = codeObject(code, JSON.stringify(this.getOptions()), this.databaseName);
    if (assemble) { //save the description to the object
        assemble.content = this.content;
        assemble.isCompiled = true;
        //get the program from source
        if (!program) {
            var obj = Assembler.database.getByName(this.databaseName);
            if (obj) {
                program = JSON.parse(obj.settings).program;
            }
        }
        assemble.compileProgram(program);
    }
    return assemble;
};

Assemble.prototype.compileProgram = function (program) {
    if (!program) return;
    try {
        var fun = new Function(program);
        if (fun) {
            //var name = this.getName();
            fun.call(this, this.getOptions());
            //this.setName(name);
        }
    } catch (e) {
        console.error(e);
        console.log(program);
    }
};

Assemble.prototype.remove = function (key) {
    //TODO remove more items, from movement
    delete this.content.declarations[key];
    delete this.content.physics[key];
};

Assemble.prototype.insert = function (name, constructor, options) {
    options = _.clone(options || {});
    options['name'] = name;
    var declaration = {
        name: name,
        path: [name],
        object: constructor,
        options: options
    };
    var key = this.makeKey(declaration, name);
    this.content.declarations[key] = declaration;
};

Assemble.prototype.setPhysics = function (part, options) {
    this.content.physics[part] = options;
};

Assemble.prototype.join = function (options, controllerOptions) {
    this.removeConnectionsToOrFrom(options.moved, options.movedIndex);
    this.removeConnectionsToOrFrom(options.fixed, options.fixedIndex);
    options.controllerOptions = controllerOptions;
    this.content.connections.push(options);
};


Assemble.prototype.hasObject = function (name, parentName) {
    return this.content.declarations[name] || this.content.physics[name] || name == parentName;
};

Assemble.prototype.renameKey = function (oldKey, newKey) {
    if (!this.hasObject(oldKey) || this.hasObject(newKey) || oldKey === newKey) return false;
    var _this = this;
    var path = newKey.split('/');
    var newName = _.last(path);
    //declarations
    var declaration = _.clone(this.content.declarations[oldKey]);
    declaration.name = newName;
    declaration.options.name = newName;
    declaration.path = path;
    delete this.content.declarations[oldKey];
    this.content.declarations[newKey] = declaration;
    //physics
    this.content.physics[newKey] = _.clone(this.content.physics[oldKey]);
    delete this.content.physics[oldKey];
    var replacePhysics = {};
    _.map(this.content.physics, function (value, key) {
        if (key.indexOf(oldKey + '/') === 0) {
            replacePhysics[key] = newKey + key.substr(oldKey.length);
        }
    });
    _.map(replacePhysics, function (nk, ok) {
        _this.content.physics[nk] = _this.content.physics[ok];
        delete _this.content.physics[ok];
    });
    //connections
    _.map(this.content.connections, function (conn) {
        //exact match, top level parts
        if (conn.moved == oldKey) {
            conn.moved = newKey;
        }
        if (conn.fixed == oldKey) {
            conn.fixed = newKey;
        }
        //initial path, deep level parts
        if (conn.moved.indexOf(oldKey + "/") === 0) {
            conn.moved = newKey + conn.moved.substr(oldKey.length);
        }
        if (conn.fixed.indexOf(oldKey + "/") === 0) {
            conn.fixed = newKey + conn.fixed.substr(oldKey.length);
        }
    });
    _.map(this.content.connectorOptions, function (opt) {
        if (opt[0] == oldKey) {
            opt[0] = newKey;
        } else if (opt[0].indexOf(oldKey + '/') === 0) {
            opt[0] = newKey + opt[0].substr(oldKey.length);
        }
    });
    return true;
};

Assemble.prototype.overControllerState = function (partKey, connectorKey, options) {
    var part = this.getPartByKey(partKey, true);
    if (!part) return;
    var conn = part.getConnector(connectorKey);
    if (!conn) return;
    conn.addEventListener('controllerSet', function () {
        if (!conn.controller) return;
        _.extend(conn.controller.settings.options, options);
        conn.removeEvent('controllerSet');
    });
};

Assemble.prototype.connect = function (options, controllerOptions) {
    //this function is called on contentToCode
    if (options.moved && options.fixed) {
        connect(options, controllerOptions, this);
    }
};

Assemble.prototype.removeConnectionsToOrFrom = function (name, index) {
    if (index === undefined) {
        this.content.connections = _.filter(this.content.connections, function (conn) {
            return !(conn.moved == name || conn.fixed == name);
        });
    } else {
        this.content.connections = _.filter(this.content.connections, function (conn) {
            return !(conn.moved == name && conn.movedIndex == index || conn.fixed == name && conn.fixedIndex == index);
        });
    }
};

Assemble.prototype.appendConnectOperation = function (fixed, moved, controllerOptions) {
    var options = {
        fixed: fixed.parentPartKey(),
        moved: moved.parentPartKey(),
        fixedIndex: fixed.getKey(),
        movedIndex: moved.getKey(),
        controllerOptions: controllerOptions
    };
    this.content.connections.push(options);
};

Assemble.prototype.removeConnectOperation = function (fixed, moved) {
    if (!this.hasAssemble()) return;
    var fixedKey = fixed.parentPartKey();
    var movedKey = moved.parentPartKey();
    var fixedName = fixed.getName();
    var movedName = moved.getName();
    var fixedIndex = fixed.index();
    var movedIndex = moved.index();
    this.content.connections = _.filter(this.content.connections, function (conn) {
        return !(conn.fixed == fixedKey
            && conn.moved == movedKey
            && (conn.movedIndex == movedName || conn.movedIndex == movedIndex)
            && (conn.fixedIndex == fixedName || conn.fixedIndex == fixedIndex));
    });
};

Assemble.prototype.getConnectOperation = function (fixed, moved) {
    var fixedKey = fixed.parentPartKey();
    var movedKey = moved.parentPartKey();
    var fixedName = fixed.getName();
    var movedName = moved.getName();
    var fixedIndex = fixed.index();
    var movedIndex = moved.index();
    return _.find(this.content.connections, function (conn) {
        return (conn.fixed == fixedKey
            && conn.moved == movedKey
            && (conn.movedIndex == movedName || conn.movedIndex == movedIndex)
            && (conn.fixedIndex == fixedName || conn.fixedIndex == fixedIndex));
    });
};

