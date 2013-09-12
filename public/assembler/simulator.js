'use strict';

var IS_DRAGGING = false,
    CANVAS_ID = "scenecanvas",
    SCENARIO = 'desk',
    RENDER_SHADOWS = false;


Physijs.scripts.worker = '../Physijs/physijs_worker.js';
Physijs.scripts.ammo = '../Physijs/ammo.js' || '../Physijs/ammo.fast.js' || '../Physijs/ammo.small.js';

function PhysicsSimulator(database) {
    this.database = database;
    var options = database.getDefaultOptions();
    this.__transparency = false;
    this._scale = 'centimeter';
    this._scales = {
        'centimeter': 100 /*,
         'meter': 1*/
    };
    this.connectors = [];
    this.programs = [];
    this.dirtyMesh = [];
    this.stop = false;
    this._paused = false;
    this.renderInterval = options.renderInterval;
    this.simulationInterval = options.simulationInterval;
    this.simulationQuality = options.simulationQuality;
    this.showConnectors = !!options.showConnectors;
    this.showAxis = !!options.showAxis;
    this.softHandling = !!options.softHandling;
    this.scenario = undefined;
    if (this.showConnectors === undefined) this.showConnectors = true;
    this.fixedTimeStep = 1.0 / (this.simulationQuality * 60.0);
    this.scene = new Physijs.Scene({fixedTimeStep: this.fixedTimeStep});
    this.movementController = new MovementController(this);
    this.runProgram = false;
    this.keysUp = {};
    this.keysDown = {};
    this.mouse = {};
    this.allowKeyboardEvents = false;
}

function sceneOf(scene) {
    if (scene instanceof PhysicsSimulator) {
        return scene.scene;
    } else if (scene instanceof Physijs.Scene) {
        return scene;
    }
    return scene;
}

PhysicsSimulator.prototype.init = function () {
    this.addRenderer();

    this.addCamera();

    //drags and drops, key presses
    this.listenToKeyboardEvents();
    this.listenToDragAndDrops();
    //start simulation
    this.renderAndSimulate();
    //camera adapter on window resize
    this.addResizeAdapter();
};

PhysicsSimulator.prototype.setScale = function (scale) {
    //if scale is registered the assume it, if not leave it
    if (this._scales[scale]) this._scale = scale;
};

PhysicsSimulator.prototype.getScaleInfo = function () {
    var info = {
        'centimeter': "Units: Distance[cm]; Force [Kg]; Torque[Kg.cm]; Velocity[cm/s]; Angle[º]",
        'meter': "Units: Distance[m]; Force [Kg]; Torque[Kg.m]; Velocity[m/s]; Angle[º]"
    };
    return info[this._scale];
};

PhysicsSimulator.prototype.scaleGravity = function (g) {
    return g * this._scales[this._scale];
};

PhysicsSimulator.prototype.scaleKgForce = function (Kg) {
    return Kg * this._scales[this._scale] * 9.81;
};

PhysicsSimulator.prototype.scaleTorque = function (Kg_cm) {
    //if the force is Kg_m the result is identical
    return Kg_cm * this._scales[this._scale] * 9.81;
};

PhysicsSimulator.prototype.scaleAngle = function (degrees) {
    return Math.PI * degrees / 180;
};

PhysicsSimulator.prototype.scaleRPM = function (rpm) {
    //to rad/sec, 1 rot == 2pi, 1 min = 60s
    //rps = rpm / 60, rad/sec = 2pi * rps
    return rpm * 2 * Math.PI / 60;
};

function disposeObject(obj) {
    if (obj instanceof THREE.Mesh) {
        if (obj.material.map instanceof THREE.Texture) {
            obj.material.map.dispose();
        }
        obj.material.dispose();
        if (!obj.isConnector) {
            obj.geometry.dispose();
        }
    } else if (obj instanceof THREE.AxisHelper) {
        obj.material.dispose();
        obj.geometry.dispose();
    }
    if (obj.children) {
        for (var i = 0; i < obj.children.length; i++) {
            disposeObject(obj.children[i]);
        }
    }
}
PhysicsSimulator.prototype.clearScene = function () {
    this.keysDown = {};
    this.keysUp = {};
    this.mouse = {};
    while (this.scene.children.length) {
        var o = this.scene.children[0];
        this.scene.remove(o);
        o.removeAllEvents && o.removeAllEvents();
        disposeObject(o);
    }
};

PhysicsSimulator.prototype.clearObject = function () {
    this.keysDown = {};
    this.keysUp = {};
    this.mouse = {};
    var objs = this.scene.children.slice();
    while (objs.length) {
        var o = objs.pop();
        if (!o.__isFromScenario) {
            this.scene.remove(o);
            o.removeAllEvents && o.removeAllEvents();
            disposeObject(o);
        }
    }
};

PhysicsSimulator.prototype.resetScene = function () {
    //stop
    var run = this.runProgram;
    var paused = this.stop;
    this.stop = true;
    this.runProgram = false;
    this.clearScene();
    this.removeScenario();
    this.scene.replaceWorker();
    this.scene.pause(!!Assembler.menus.getOption('pause'));
    this.runProgram = run;
    this.stop = paused;

};

PhysicsSimulator.prototype.possibleRenderer = function () {
    if (Detector.webgl) {
        RENDER_SHADOWS = true;
        return new THREE.WebGLRenderer({
            preserveDrawingBuffer: true, //used only to get the image
            antialias: true
        });
    } else {
        RENDER_SHADOWS = false;
        return new THREE.CanvasRenderer();
    }
};

PhysicsSimulator.prototype.addRenderer = function (options) {
    options = _.defaults(options || {}, {
        width: window.innerWidth,
        height: window.innerHeight,
        container: "container"
    });
    var renderer = this.possibleRenderer();
    renderer.sortObjects = false;
    renderer.setSize(options.width, options.height);
    renderer.domElement.id = CANVAS_ID;
    document.getElementById(options.container).appendChild(renderer.domElement);
    this.renderer = renderer;
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    return renderer;
};

PhysicsSimulator.prototype.addCamera = function (options) {
    var defaults = {
        ratio: null,
        width: window.innerWidth,
        height: window.innerHeight,
        distance: 60
    };
    options = _.defaults(options || {}, defaults);
    var camera = new THREE.PerspectiveCamera(
        35,
        options.ratio || options.width / options.height,
        0.1,
        10000
    );
    this.camera = camera;
    camera.position.set(options.distance, options.distance, options.distance);
    camera.lookAt(this.scene.position);
    this.scene.add(camera);

    //the camera control
    var controls = new THREE.TrackballControls(camera, this.renderer.domElement);
    this.cameraControls = controls;
    controls.target.set(0, 0, 0);
    controls.rotateSpeed = controls.zoomSpeed = controls.panSpeed = 4.0;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = true;
    this.trackBallControls = controls;
    return camera;
};

PhysicsSimulator.prototype.addResizeAdapter = function () {
    //CREDITS: http://learningthreejs.com/data/THREEx/THREEx.WindowResize.js
    var _this = this;
    var callback = function () {
        // notify the renderer of the size change
        _this.renderer.setSize(window.innerWidth, window.innerHeight);
        // update the camera
        _this.camera.aspect = window.innerWidth / window.innerHeight;
        _this.camera.updateProjectionMatrix();
    };
    // bind the resize event
    window.addEventListener('resize', callback, false);
    return {
        stop: function () {
            window.removeEventListener('resize', callback);
        }
    };
};

PhysicsSimulator.prototype.reloadScenario = function (scenarioName, force) {
    scenarioName = scenarioName || this.scenario;
    if (!scenarioName) {
        scenarioName = Assembler.menus.getOption('scenario') || SCENARIO;
    }
    var scenario = SCENARIOS[scenarioName];
    if (!scenario) {
        console.log("unrecognized scenario: " + scenarioName);
        console.log("should be one of:");
        console.log(SCENARIOS);
        return false;
    }
    if (force) {
    } else if (scenarioName === this.scenario) {
        return false;
    }
    this.scenario = scenarioName;
    this.removeScenario();
    this.addScenario(new scenario());
    return true;
};

PhysicsSimulator.prototype.addScenario = function (scenario) {
    var scene = sceneOf(this);
    scene.setGravity([0, this.scaleGravity(scenario.gravity), 0]);
    scenario.makeLights();
    scenario.lights.map(function (light) {
        light.__isFromScenario = true;
        scene.add(light);
    });
    scenario.makeGround();
    if (scenario.ground) {
        scenario.ground.__isFromScenario = true;
        scene.add(scenario.ground);
    }
    scenario.makeAxes();
    scenario.axes.__isFromScenario = true;
    scenario.axes.__isAxis = true;
    scenario.axes.material.visible = !!this.showAxis;
    scene.add(scenario.axes);
    var intersect_plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000, 1, 1),
        new THREE.MeshBasicMaterial({
            visible: false,
            castShadow: false,
            receiveShadow: false
        })
    );
    //which type of event location x, y to use
    intersect_plane.visible = false;
    intersect_plane.up.copy(new THREE.Vector3(0, 0, 1));
    intersect_plane.__isFromScenario = true;
    this._intersectPlane = intersect_plane;
    scene.add(intersect_plane);
    //this.renderer.render(this.scene, this.camera);
    $("#" + CANVAS_ID).css("background", scenario.backgroundColor);
};

PhysicsSimulator.prototype.removeScenario = function () {
    var scene = sceneOf(this);
    scene.children.map(function (obj) {
        if (obj.__isFromScenario) {
            scene.remove(obj);
            if (obj.mesh) {
                obj.mesh.geometry && obj.mesh.geometry.dispose();
                obj.mesh.material.texture && obj.mesh.material.texture.dispose();
                obj.mesh.material && obj.mesh.material.dispose();
            }
        }
    });
    this.scenario = undefined;
};

PhysicsSimulator.prototype.toggleAxis = function (show) {
    var scene = sceneOf(this);
    scene.children.map(function (obj) {
        if (obj.__isAxis) {
            obj.material.visible = !!show;
        }
    });
};

PhysicsSimulator.prototype.startFreezing = function () {
    var _this = this;
    _this.__freeze = true;
    this.scene.children.map(function (mesh) {
        if (_this.dirtyMesh.indexOf(mesh) < 0 && mesh.removable && (mesh instanceof Physijs.Mesh)) {
            mesh.__dirtyPosition = true;
            mesh.__dirtyRotation = true;
            mesh.dirtyPosition = mesh.position.clone();
            mesh.dirtyRotation = mesh.rotation.clone();
        }
    });
};

PhysicsSimulator.prototype.stopFreezing = function () {
    var _this = this;
    _this.__freeze = false;
    this.scene.children.map(function (mesh) {
        if (_this.dirtyMesh.indexOf(mesh) < 0 && mesh.removable && (mesh instanceof Physijs.Mesh)) {
            //mesh.__dirtyPosition = false;
            //mesh.__dirtyRotation = false;
            delete mesh.dirtyPosition;
            delete mesh.dirtyRotation;
        }
    });
};

PhysicsSimulator.prototype.keepFreezing = function () {
    if (!this.__freeze) return;
    var _this = this;
    var zero = new THREE.Vector3();
    this.scene.children.map(function (mesh) {
        if (_this.dirtyMesh.indexOf(mesh) < 0 && mesh.removable && (mesh instanceof Physijs.Mesh)) {
            mesh.__dirtyPosition = true;
            mesh.__dirtyRotation = true;
            mesh.position.copy(mesh.dirtyPosition);
            mesh.rotation.copy(mesh.dirtyRotation);
            mesh.setLinearVelocity(zero);
            mesh.setAngularVelocity(zero);
        }
    });
};

PhysicsSimulator.prototype.addDirty = function (mesh, position, rotation) {
    this.dirtyMesh.push(mesh);
    mesh.__dirtyPosition = true;
    mesh.__dirtyRotation = true;
    mesh.dirtyPosition = (position || mesh.position).clone();
    mesh.dirtyRotation = (rotation || mesh.rotation).clone();
};

PhysicsSimulator.prototype.removeDirty = function () {
    for (var i = 0; i < this.dirtyMesh.length; i++) {
        var mesh = this.dirtyMesh[i];
        this.setDirty(mesh, mesh.dirtyPosition, mesh.dirtyRotation);
        mesh.setLinearVelocity(new THREE.Vector3());
        mesh.setAngularVelocity(new THREE.Vector3());
        mesh.__dirtyPosition = true;
        mesh.__dirtyRotation = true;
        mesh.dirtyPosition = undefined;
        mesh.dirtyRotation = undefined;
    }
    this.dirtyMesh = [];
};

PhysicsSimulator.prototype.setDirty = function (mesh, position, rotation) {
    mesh.__dirtyPosition = true;
    mesh.__dirtyRotation = true;
    position && mesh.dirtyPosition && mesh.dirtyPosition.copy(position);
    rotation && mesh.dirtyRotation && mesh.dirtyRotation.copy(rotation);
};

PhysicsSimulator.prototype.overwriteDirty = function () {
    if (!this.dirtyMesh.length) return;
    for (var i = 0; i < this.dirtyMesh.length; i++) {
        var mesh = this.dirtyMesh[i];
        mesh.__dirtyPosition = true;
        mesh.__dirtyRotation = true;
        mesh.position.copy(mesh.dirtyPosition);
        mesh.rotation.copy(mesh.dirtyRotation);
    }
};

PhysicsSimulator.prototype.preventFalling = function () {
    var simulator = this;
    simulator.__countPrevent || (simulator.__countPrevent = 0);
    simulator.__countPrevent++;
    simulator.__countPrevent = simulator.__countPrevent % 20;
    if (simulator.__countPrevent != 1) return;
    var threshold = -50;
    for (var i = 0; i < this.scene.children.length; i++) {
        var mesh = this.scene.children[i];
        if ((mesh instanceof Physijs.Mesh) && (mesh.position.y < threshold) && mesh.part && mesh.part.connectors[0]) {
            var conn = mesh.part.connectors[0];
            if (!conn) return;
            var min = conn.networkMinY();
            var vec = conn.mesh.localToWorld(Vec3());
            vec.z = vec.x = 10 + Math.round(30 * Math.random());
            vec.y = vec.y - min + vec.z;
            conn.moveNetwork(vec, conn.networkRelativePositions());
            setTimeout(function () {
                simulator.removeDirty();
            }, simulator.simulationInterval * 2);
        }
    }
};

PhysicsSimulator.prototype.toggleBodiesTransparency = function (value) {
    function makeTransparent(mesh) {
        if (mesh.removable && !mesh.isConnector) {
            if (mesh.material.__transparencyChanged) {
                _.each(mesh.children, makeTransparent);
            } else {
                mesh.__backupOpacity = mesh.__backupOpacity || mesh.material.opacity;
                mesh.__backupTransparent = mesh.__backupTransparent || !!mesh.material.transparent;
                mesh.material.transparent = true;
                mesh.material.opacity = mesh.__backupOpacity / 1.3;
                mesh.material.__transparencyChanged = true;
                _.each(mesh.children, makeTransparent);
                mesh.material.__transparencyChanged = false;
            }
        }
    }

    function makeOpaque(mesh) {
        if (mesh.removable && !mesh.isConnector) {
            if (mesh.material.__transparencyChanged) {
                _.each(mesh.children, makeOpaque);
            } else {
                mesh.material.opacity = mesh.__backupOpacity;
                mesh.material.transparent = mesh.__backupTransparent;
                mesh.material.__transparencyChanged = true;
                _.each(mesh.children, makeOpaque);
                mesh.material.__transparencyChanged = false;
            }
        }
    }

    if (value) {
        if (this.__transparency == false) {
            this.scene.children.map(makeTransparent);
            this.__transparency = true;
        }
    } else {
        if (this.__transparency == true) {
            this.scene.children.map(makeOpaque);
            this.__transparency = false;
        }
    }
};

PhysicsSimulator.prototype.rescaleConnectors = function () {
    var scale = Vec3(this.connectorRadius, this.connectorRadius, this.connectorRadius);
    this.connectors.map(function (c) {
        c.center && c.center.scale.copy(scale);
    });
};

PhysicsSimulator.prototype.refreshCanvas = function () {
    this.renderer.render(this.scene, this.camera);
};

PhysicsSimulator.prototype.renderAndSimulate = function () {
    var _this = this;
    var t0 = 0; //do we really need to remove event listeners?
    var t1 = 0;
    render();
    simulateOnce();
    function render() {
        if (!_this.stop) {
            _this.loopAndRunPrograms('beforeDraw');
            _this.renderer.render(_this.scene, _this.camera);
            _this.cameraControls.update();
            _this.loopAndRunPrograms('afterDraw');
        }
        clearTimeout(t0);
        t0 = setTimeout(function () {
            requestAnimationFrame(render);
        }, _this.renderInterval);
    }

    function simulateOnce() {
        if (!_this.stop) {
            _this.loopAndRunPrograms('step');
            _this.loopAndRunPrograms('keys');
            //https://github.com/chandlerprall/Physijs/issues/45
            _this.overwriteDirty();
            _this.keepFreezing();
            _this.movementController.moveToTarget();
            _this.scene.simulate(_this.fixedTimeStep * _this.simulationQuality, _this.simulationQuality);
            _this.overwriteDirty();
            _this.keepFreezing();
            _this.preventFalling();
        }
        clearTimeout(t1);
        t1 = setTimeout(function () {
            simulateOnce();
        }, _this.simulationInterval);
    }
};

PhysicsSimulator.prototype.loopAndRunPrograms = function (event) {
    if (this.stop) {
        this.toggleKeyboardEvents(false);
        return;
    }
    if (!this.runProgram || this._paused) return;
    var _this = this;
    if (['step', 'beforeDraw', 'afterDraw'].indexOf(event) > -1) {
        this.programs.map(function (p) {
            p.run(event);
        });
    } else if (event == 'keys') {
        this.programs.map(function (p) {
            p.run('keys', _.uniq(_.without(_.values(_this.keysDown), undefined)), _.uniq(_.without(_.values(_this.keysUp), undefined)), _this.mouse);
        });
        _this.keysDown = _.omit(_this.keysDown, _.keys(_this.keysUp));
        _this.keysUp = {};
        _this.mouse = {};
    }
};

PhysicsSimulator.prototype.pause = function (value) {
    this._paused = !!value;
    sceneOf(this).pause(this._paused);
};

/**
 * catch key events to be used by programs
 */

PhysicsSimulator.prototype.toggleKeyboardEvents = function (value) {
    this.allowKeyboardEvents = !!value;
    if (!value) {
        //if some key was pressed trigger keyup
        _.extend(this.keysUp, this.keysDown);
    }
};

PhysicsSimulator.prototype.listenToKeyboardEvents = function () {
    var _this = this;
    var specialKeys = {
        32: "space",
        37: "left",
        38: "up",
        39: "right",
        40: "down",
        17: "ctrl",
        16: "shift",
        18: "alt",
        9: "tab",
        46: "del",
        13: "enter",
        8: "backspace",
        20: "caps",
        27: "esc"
    };
    var keyRelations = _.clone(specialKeys);
    var keyDownKeyCode = null;
    $(window).on('keypress', function (evt) {
        if (!_this.allowKeyboardEvents) return;
        if (keyDownKeyCode !== null) {
            keyRelations[keyDownKeyCode] = String.fromCharCode(evt.keyCode).toLowerCase();
            _this.keysDown[keyDownKeyCode] = keyRelations[keyDownKeyCode];
            keyDownKeyCode = null;
        }
    });
    $(window).on('keydown', function (evt) {
        if (!_this.allowKeyboardEvents) return;
        keyDownKeyCode = specialKeys[evt.keyCode] ? null : evt.keyCode;
        _this.keysDown[evt.keyCode] = specialKeys[evt.keyCode];
    });
    $(window).on('keyup', function (evt) {
        if (!_this.allowKeyboardEvents) return;
        if (keyRelations[evt.keyCode]) {
            _this.keysUp[evt.keyCode] = keyRelations[evt.keyCode];
            keyDownKeyCode = specialKeys[evt.keyCode] ? null : evt.keyCode;
            if (keyDownKeyCode){
                delete _this.keysDown[keyDownKeyCode];
            }
            delete _this.keysDown[evt.keyCode];
            keyDownKeyCode = null;
        }
    });
};

PhysicsSimulator.prototype.registerMouseEvent = function (evt, mesh) {
    _.extend(this.mouse, {
        x: evt.offsetX,
        y: evt.offsetY
    });
    if (mesh && mesh.part && mesh.material.visible) {
        this.mouse["*"] = mesh.part.getName();
        this.mouse.partKey = mesh.part.getKey();
        this.mouse.partPath = this.mouse.partKey.split('/');
    } else {
        this.mouse["*"] = "";
        this.mouse.partKey = undefined;
        this.mouse.partPath = [];
    }
};

PhysicsSimulator.prototype.getTouchableConnectorsMeshes = function (without) {
    return _.pluck(_.filter(this.connectors,
        function (c) {
            return !(c === without) && c.isTouchable && c.mesh.material.visible;
        }
    ), 'mesh');
};

PhysicsSimulator.prototype.getPartMeshes = function () {
    return _.filter(this.scene.children,
        function (c) {
            return c instanceof THREE.Mesh && c.part && c.part.connectors.length;
        }
    );
};

PhysicsSimulator.prototype.listenToDragAndDrops = function () {
    var moveController = this.movementController;
    var _this = this;
    var simulator = _this;
    var ray, intersections, blocks;
    var _vector = new THREE.Vector3,
        projector = new THREE.Projector(),
        handleMouseDown, handleMouseMove, handleMouseUp;
    var selected, target;
    var netPos = [];
    var resetColors = {};
    var measure = ["client", "page", "offset", "layer"][1];
    handleMouseDown = function (evt) {
        _vector.set(
            ( evt[measure + "X"] / window.innerWidth ) * 2 - 1,
            -( evt[measure + "Y"] / window.innerHeight ) * 2 + 1,
            1
        );
        projector.unprojectVector(_vector, simulator.camera);
        ray = new THREE.Raycaster(simulator.camera.position, _vector.sub(simulator.camera.position).normalize());
        if (_this.showConnectors) {
            blocks = _this.getTouchableConnectorsMeshes(null);
        } else {
            blocks = _this.getPartMeshes();
        }
        intersections = ray.intersectObjects(blocks, true);
        var obj;
        if (intersections.length > 0) {
            obj = intersections[0].object;
            if (_this.showConnectors) {
                while (obj && !obj.parentConnector) {
                    obj = obj.parent;
                }
            } else {
                while (obj && !(obj.part && obj.part.centerConnector)) {
                    obj = obj.parent;
                }
            }
        }
        if (obj) {
            $('#' + CANVAS_ID).css('cursor', 'move');
            IS_DRAGGING = true;
            if (_this.showConnectors) {
                simulator.toggleBodiesTransparency(true);
                selected = obj.parentConnector;
            } else {
                selected = obj.part.centerConnector;
                _this.registerMouseEvent(evt, obj);
            }
            netPos = selected.networkRelativePositions();
            if (selected.isConnected) {
                selected.errorColor();
            } else {
                selected.dragColor();
            }
            resetColors[selected.index() + selected.parentPartID()] = selected;
            selected.showGUI('single', true);
            _this._intersectPlane.lookAt(simulator.camera.position);
            _this._intersectPlane.position.copy(selected.mesh.parent.position);
            if (!simulator.softHandling) {
                simulator.addDirty(selected.mesh.parent);
                simulator.startFreezing();
            } else {
                moveController.reset();
                moveController.setTarget(selected.getPosition());
                moveController.setConnector(selected);
            }
        }
    };
    handleMouseMove = function (evt) {
        if (IS_DRAGGING && selected) {
            _vector.set(
                ( evt[measure + "X"] / window.innerWidth ) * 2 - 1,
                -( evt[measure + "Y"] / window.innerHeight ) * 2 + 1,
                1
            );
            projector.unprojectVector(_vector, simulator.camera);
            ray = new THREE.Raycaster(simulator.camera.position, _vector.sub(simulator.camera.position).normalize());
            intersections = ray.intersectObject(_this._intersectPlane);
            if (intersections.length > 0) {
                _vector.copy(intersections[0].point);
                if (!simulator.softHandling) {
                    selected.interactiveMoveNetwork(_vector, netPos, simulator);
                    selected.interactiveMovePart(_vector, simulator);
                } else {
                    moveController.setTarget(_vector.clone());
                }
            }
            blocks = _this.getTouchableConnectorsMeshes(selected);
            _vector.set(
                ( evt[measure + "X"] / window.innerWidth ) * 2 - 1,
                -( evt[measure + "Y"] / window.innerHeight ) * 2 + 1,
                1
            );
            projector.unprojectVector(_vector, simulator.camera);
            ray = new THREE.Raycaster(simulator.camera.position, _vector.sub(simulator.camera.position).normalize());
            intersections = ray.intersectObjects(blocks, false);
            if (intersections.length > 0) {
                target = intersections[0].object.parentConnector;
                if (target.isConnected) {
                    target.errorColor();
                } else {
                    target.overColor();
                    moveController.setTarget(target.getPosition().clone());
                }
                resetColors[target.index() + target.parentPartID()] = target;
                $('#' + CANVAS_ID).css('cursor', 'crosshair');
            } else {
                target && target.outColor();
                target = null;
                $('#' + CANVAS_ID).css('cursor', 'move');
            }

        } else {
            _vector.set(
                ( evt[measure + "X"] / window.innerWidth ) * 2 - 1,
                -( evt[measure + "Y"] / window.innerHeight ) * 2 + 1,
                1
            );
            projector.unprojectVector(_vector, simulator.camera);
            ray = new THREE.Raycaster(simulator.camera.position, _vector.sub(simulator.camera.position).normalize());

            blocks = _this.getTouchableConnectorsMeshes(null);

            intersections = ray.intersectObjects(blocks, false);
            if (intersections.length > 0) {
                var conn = intersections[0].object.parentConnector;
                if (conn.isConnected) {
                    conn.errorColor();
                } else {
                    conn.overColor();
                }
                resetColors[conn.index() + conn.parentPartID()] = conn;

                $('#' + CANVAS_ID).css('cursor', 'pointer');
            } else {
                _.values(resetColors).map(function (conn) {
                    conn.outColor();
                });
                resetColors = {};
                $('#' + CANVAS_ID).css('cursor', 'auto');
            }
        }
    };
    handleMouseUp = function () {
        //handleMouseMove(evt);
        IS_DRAGGING = false;
        if (selected) {
            if (_this.showConnectors) {
                simulator.toggleBodiesTransparency(false);
            }
            selected.outColor();
            $('#' + CANVAS_ID).css('cursor', 'auto');
            if (!simulator.softHandling) {
                simulator.stopFreezing();
                simulator.removeDirty();
            } else {
                moveController.reset();
            }
            if (target && target != selected && !target.isConnected && !selected.isConnected) {
                selected.interactiveMode = true;
                connect(
                    {
                        moved: selected.parentPart,
                        movedIndex: selected.getKey(),
                        fixed: target.parentPart,
                        fixedIndex: target.getKey()
                    },
                    {   //prompt for the connection menu
                        needConfirm: true
                    }
                );
            }
        }
        _.values(resetColors).map(function (conn) {
            conn.outColor();
        });
        resetColors = {};
        target = null;
        selected = null;
    };
    simulator.renderer.domElement.addEventListener('mousedown', handleMouseDown);
    simulator.renderer.domElement.addEventListener('mousemove', handleMouseMove);
    simulator.renderer.domElement.addEventListener('mouseup', handleMouseUp);
    simulator.renderer.domElement.addEventListener('touchstart', handleMouseDown);
    simulator.renderer.domElement.addEventListener('touchmove', handleMouseMove);
    simulator.renderer.domElement.addEventListener('touchend', handleMouseUp);

    var shiftTrue = function (evt) {
        if (!IS_DRAGGING && evt.altKey && evt.ctrlKey) {
            simulator.toggleBodiesTransparency(true);
        }
    };
    var shiftFalse = function () {
        if (!IS_DRAGGING) {
            simulator.toggleBodiesTransparency(false);
        }
    };
    window.addEventListener('keydown', shiftTrue);
    window.addEventListener('keyup', shiftFalse);
};

