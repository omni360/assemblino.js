/**
 * Connectors allow to bind parts and create controlled constraints.
 * They are represented by spheres with a 3 axial helper.
 * Connectors do not have physical behaviour.
 */

var connectorGeometries = {};
function Connector() {
    Physijs.Eventable.call(this);
    var options = _.defaults(arguments[0] || {}, {
        name: undefined,
        base: [0, 0, 0],
        up: [0, 1, 0],
        front: [1, 0, 0],
        color: 0xFFFF99,
        overColor: 0x337733,
        dragColor: 0x666699,
        errorColor: 0xEE2222,
        opacity: 0.6,
        accept: Assembler.actuators.getConstraintKeys(),
        showAxis: true,
        prefer: 'fix',
        touchable: true
    });
    var radius = 1;
    var axisFactor = 2;
    var segments = 12;
    var scale = Assembler.simulator.connectorRadius || 0.5;
    options.base = Vec3(options.base);
    options.up = Vec3(options.up).normalize();
    options.front = Vec3(options.front).normalize();
    //check if they are perpendicular 1% error allowed
    if(options.up.clone().dot(options.front)>0.01){
          notify('Error:\nIn connector named "' + options.name + '"\nup and front are not perpendicular.');
    }
    this.options = options;
    var key, center;
    if (!options.touchable){
        segments = 3;
    }
    key = [radius, segments, segments].join(",");
    if (!connectorGeometries[key]) connectorGeometries[key] = new THREE.SphereGeometry(radius, segments, segments);
    if (!options.touchable){
        center = new THREE.Mesh(
            connectorGeometries[key],
            new THREE.MeshBasicMaterial({
                visible: false,
                opacity: 0,
                transparent: true
            })
        );
    }else {
        center = new THREE.Mesh(
            connectorGeometries[key],
            new THREE.MeshLambertMaterial({
                color: options.color,
                transparent: true,
                opacity: options.opacity
            })
        );
    }
    options.up.normalize();
    options.front.normalize();
    this.base = options.base;
    this.up = options.up;
    this.front = options.front;

    var axis = new THREE.AxisHelper(radius * axisFactor);
    //rotate the axis to match required directions
    axis.up.copy(this.up); // (y axis, green)
    axis.lookAt(this.front); // (z axis, blue)
    axis.updateMatrix();

    //reset up
    axis.up.copy(Vec3(0, 1, 0));

    if (!options.touchable){
        axis.material.visible = false;
        axis.material.opacity = 0;
        axis.material.transparent = true;
    } else {
        axis.material.linewidth = 2;
    }
    this.axisHelper = axis;
    this.center = center;
    this.mesh = center;
    this.mesh.isConnector = true;
    this.mesh.parentConnector = this;
    this.isTouchable = options.touchable;
    center.add(axis);
    center.position.copy(options.base);
    center.scale.copy(Vec3(scale,scale,scale));
}

Physijs.Eventable.make(Connector);

Connector.prototype.index = function () {
    return this.parentPart.connectors.indexOf(this);
};

Connector.prototype.getName = function () {
    return this.options.name;
};

Connector.prototype.getKey = function () {
    return this.getName() || this.index();
};

Connector.prototype.selfDestroy = function () {
    this.breakConnection();
    destroyObject(this.options);
    destroyObject(this);
};

Connector.prototype.visible = function (value) {
    if (value !== undefined && this.isTouchable) {
        this.mesh.material.visible = !!value;
        this.axisHelper.material.visible = !!value;
    }
    return this.mesh.material.visible;
};

Connector.prototype.parentPartID = function () {
    return this.parentPart.getName();
};

Connector.prototype.parentPartKey = function () {
    return this.parentPart.getKey();
};


Connector.prototype.getPosition = function () {
    return Vec3().getPositionFromMatrix(this.axisHelper.matrixWorld);
};


Connector.prototype.overColor = function () {
    var scale = Assembler.simulator.connectorRadius || 0.5;
    this.center.material.color.setHex(this.options.overColor);
    this.center.scale.copy(Vec3(1,1,1).multiplyScalar(scale * 1.2));
};

Connector.prototype.dragColor = function () {
    var scale = Assembler.simulator.connectorRadius || 0.5;
    this.center.material.color.setHex(this.options.dragColor);
    this.center.scale.copy(Vec3(1,1,1).multiplyScalar(scale * 1.2));
};

Connector.prototype.errorColor = function () {
    var scale = Assembler.simulator.connectorRadius || 0.5;
    this.center.material.color.setHex(this.options.errorColor);
    this.center.scale.copy(Vec3(1,1,1).multiplyScalar(scale * 1.2));
};

Connector.prototype.outColor = function () {
    var scale = Assembler.simulator.connectorRadius || 0.5;
    this.center.material.color.setHex(this.options.color);
    this.center.scale.copy(Vec3(1,1,1).multiplyScalar(scale));
};

Connector.prototype.breakConnection = function () {
    var _this = this;
    if (!_this.isConnected) return;
    var fixed = _this.pairConnector;
    _this.isConnected = false;
    _this.pairConnector = undefined;
    fixed.isConnected = false;
    fixed.pairConnector = undefined;
    _this.controller && _this.controller.selfDestroy();
    _this.controller = null;
    fixed.controller = null;
    _this.manager.removeConnectOperation(_this, fixed);
    _this.manager.removeConnectOperation(fixed, _this);
};

Connector.prototype.isRootConnection = function () {
    if (!this.isConnected) return false;
    return !!(this.manager.getConnectOperation(this, this.pairConnector) || this.manager.getConnectOperation(this.pairConnector, this));
};

function preferType(fixed, moved) {
    var type = fixed.options.prefer;
    if (moved.options.prefer == fixed.options.prefer) {
        type = fixed.options.prefer;
    } else {
        var common = _.union(fixed.options.accept, moved.options.accept);
        if (common.indexOf(fixed.options.prefer) > -1) {
            type = fixed.options.prefer;
        } else if (common.indexOf(moved.options.prefer) > -1) {
            type = moved.options.prefer;
        }
    }
    return type;
}

Connector.prototype.connectTo = function (fixed, simulator, _this, options, system) {
    _this = _this || this;
    if (_this.isConnected || fixed.isConnected) {
        notify("already connected!");
        return;
    }
    if (_this.parentPart == fixed.parentPart) {
        //notify("can not connect to itself!");
        return;
    }
    var type;
    options = options || {};
    if (options.type) {
        type = options.type;
    } else {
        type = preferType(fixed, _this);
    }
    //to get the actuator type and settings
    //only in interactive mode
    if (options.needConfirm) {
        _this.simulator.pause(true);
        var settings = {
            type: type,
            name: nextName('CONTROL')
        };
        var defaults = Assembler.actuators.getDefaults(type);
        settings = _.extend(settings, defaults);
        settings = _.extend(settings, options);
        while (Assembler.manager.hasObject(settings.name, Assembler.manager.getObjectName())){
             settings.name = nextName(settings.name);
        }
        var types = _.intersection(fixed.options.accept, _this.options.accept, Assembler.actuators.getConstraintKeys());
        types = _.without(types, type);
        settings.type = [type].concat(types.sort());
        //compute best mirror value for the y axis
        settings.mirror = computeBestMirror(fixed, _this);
        delete settings.needConfirm;
        var updateComponent = function() {
            settings = Assembler.menus.popMenuValues(settings);
            if (Assembler.manager.object.getController(settings.name)){
                notify('The controller name ' + settings.name + ' is taken. Please choose other one.');
                return;
            }
            Assembler.menus.clearPopMenu();
            _this.connectTo(fixed, simulator, _this, settings);
            //options = _.extend(options, settings);
        };
        var title = 'Connect: '
            + _this.parentPartKey() + ".[" + (_this.getName() || _this.index()) + "] to "
            + fixed.parentPartKey() + ".[" + (fixed.getName() || fixed.index()) + "]";
        Assembler.menus.makePopMenu({
            title: title,
            content: settings,
            buttons: {
                'Cancel': function () {
                    Assembler.menus.clearPopMenu();
                    if (_this.interactiveMode) {
                        setTimeout(function () {
                            simulator.stopFreezing();
                            simulator.pause(false);
                        }, _this.simulator.simulationInterval * 2);
                    }
                },
                Connect: updateComponent
            },
            onChange: {
                type: function (value) {
                    var newOptions = _.extend({}, options);
                    newOptions.type = value;
                    newOptions.name = settings.name;
                    newOptions.needConfirm = true;
                    Assembler.menus.clearPopMenu();
                    _this.connectTo(fixed, simulator, _this, newOptions);
                }
            },
            info: Assembler.actuators.getInfo(type)
        });
        return;
    }
    var netParts;
    if (_this.interactiveMode) {
        netParts = _this.networkMeshesToTransformInADirtyConnection(fixed.parentPart);
    }
    _this.isConnected = true;
    _this.pairConnector = fixed;
    _this.isFixed = false;
    fixed.isConnected = true;
    fixed.pairConnector = _this;
    fixed.isFixed = true;
    var object = _this.center.parent;
    var target = fixed.center.parent;
    var axisb, frontb;
    var positionb;
    if (_this.interactiveMode) {
        //overwrite positions
        object.__dirtyPosition = true;
        object.__dirtyRotation = true;
        object.setLinearVelocity(Vec3());
        object.setAngularVelocity(Vec3());

        target.__dirtyPosition = true;
        target.__dirtyRotation = true;
        target.setLinearVelocity(Vec3());
        target.setAngularVelocity(Vec3());

        //move object to target, to match connectors positions
        simulator.scene.updateMatrixWorld(true);
        var selfAxisTransform = new THREE.Matrix4();
        selfAxisTransform.getInverse(_this.axisHelper.matrixWorld);
        var totalTransform = new THREE.Matrix4();
        totalTransform.multiplyMatrices(selfAxisTransform, totalTransform);
        //now consider the offsets and inversion
        axisb = _this.up.clone();
        frontb = _this.front.clone();
        if (options.invert || options.mirror) {
            axisb.negate();
            frontb.negate();
            var matrix = new THREE.Matrix4();
            matrix.makeRotationZ(Math.PI);
            totalTransform.multiplyMatrices(matrix, totalTransform);
        }
        positionb = _this.base.clone();
        if (options.offset){
            var direction = axisb.clone().normalize().multiplyScalar(options.offset);
            positionb.add(direction);
            var matrixOffset = new THREE.Matrix4();
            matrixOffset.setPosition(direction);
            totalTransform.multiplyMatrices(matrixOffset, totalTransform);
        }
        totalTransform.multiplyMatrices(fixed.axisHelper.matrixWorld, totalTransform);
        if(!simulator.softHandling && netParts && netParts.length) {
            netParts.map(function(mesh){
                mesh.__dirtyPosition = true;
                mesh.__dirtyRotation = true;
                mesh.setLinearVelocity(Vec3());
                mesh.setAngularVelocity(Vec3());
                mesh.applyMatrix(totalTransform);
            });
        }
        simulator.scene.updateMatrixWorld(true);
    }
    type = options.type || type;
    options.name = options.name || type + nextInt(type);
    if (!_this.interactiveMode) {
        axisb = _this.up.clone();
        frontb = _this.front.clone();
        if (options.invert || options.mirror) {
            axisb.negate();
            frontb.negate();
        }
        positionb = _this.base.clone();
        if (options.offset){
            var direction2 = axisb.clone().normalize().multiplyScalar(options.offset);
            positionb.add(direction2);
        }
    }
    var controller = new Controller({
        name: options.name,
        type: type,
        objecta: target,
        objectb: object,
        positiona: fixed.base.clone(),
        positionb: positionb,
        axisa: fixed.up.clone(),
        fronta: fixed.front.clone(),
        axisb: axisb,
        frontb: frontb,
        positionaIsLocal: true,
        positionbIsLocal: true,
        axisaIsLocal: true,
        axisbIsLocal: true,
        options: options
    });
    _this.controller = fixed.controller = controller;
    fixed.dispatchEvent('controllerSet');
    controller.addEventListener('constraintReady', function () {
        if (system) {
            system.addController(controller);
        }
        if (_this.interactiveMode) {
            setTimeout(function () {
                simulator.stopFreezing();
                simulator.pause(false);
                _this.showGUI('moved', true);
                _this.showGUI('fixed', false);
            }, _this.simulator.simulationInterval * 2);
        }
    });
    controller.addToScene(simulator);
    if (_this.interactiveMode) {
        _this.manager.appendConnectOperation(fixed, _this, options);
        _this.manager.saveAllPositions();
        _this.manager.updateValueAndHistory();
    }
    if (_this.interactiveMode) {
        simulator.startFreezing();
    }
};

/**
 * This computes the default mirror value for the connection,
 * making it more user friendly, as they do not have to woryy much about the
 * alignment of the y green axis.
 * @param fixed
 * @param moved
 * @returns {boolean}
 */
function computeBestMirror(fixed, moved){
    //transform to move fixed connector to 0,0,0 and align axis with the origin x,y,z
    var fixedConnectorToOrigin = new THREE.Matrix4();
    fixedConnectorToOrigin.getInverse(fixed.axisHelper.matrixWorld);
    //transform to move moved connector to 0,0,0 and align axis with the origin x,y,z
    var movedConnectorToOrigin = new THREE.Matrix4();
    movedConnectorToOrigin.getInverse(moved.axisHelper.matrixWorld);
    //the position of the mesh after translating and rotating the connector to origin
    var fixedOrigin = fixed.parentPart.mesh.position.clone().applyMatrix4(fixedConnectorToOrigin);
    var movedOrigin = moved.parentPart.mesh.position.clone().applyMatrix4(movedConnectorToOrigin);
    //prefer mirror if at the end the bodies are most apart
    var withoutMirror = movedOrigin.sub(fixedOrigin).length();
    //if we invert...
    var inversion = new THREE.Matrix4();
    inversion.makeRotationZ(Math.PI);
    movedConnectorToOrigin.multiplyMatrices(inversion, movedConnectorToOrigin);
    movedOrigin = moved.parentPart.mesh.position.clone().applyMatrix4(movedConnectorToOrigin);
    var withMirror = movedOrigin.sub(fixedOrigin).length();
    return withMirror > withoutMirror;
}

function connect(options, controllerOptions, system) {
    var moved = options.moved;
    var fixed = options.fixed;
    var movedIndex = options.movedIndex;
    var fixedIndex = options.fixedIndex;
    var a = moved.isReady;
    var b = fixed.isReady;
    if (controllerOptions == undefined || (controllerOptions instanceof PhysicsSimulator)) {
        controllerOptions = {};
    }
    function doConnect(moved, indexMoved, fixed, indexFixed) {
        if (!(a && b)) {
            return false;
        } else if (moved.getConnector(indexMoved) && fixed.getConnector(indexFixed)) {
            moved.getConnector(indexMoved).connectTo(fixed.getConnector(indexFixed), Connector.prototype.simulator, moved.getConnector(indexMoved), controllerOptions, system);
            return true;
        } else {
            return false;
        }
    }

    if (doConnect(moved, movedIndex, fixed, fixedIndex)) {
        return;
    }
    moved.mesh.addEventListener('ready', function () {
        moved.isReady = a = true;
        doConnect(moved, movedIndex, fixed, fixedIndex);
    });
    fixed.mesh.addEventListener('ready', function () {
        fixed.isReady = b = true;
        doConnect(moved, movedIndex, fixed, fixedIndex);
    });
}

Connector.prototype.showGUI = function (type, clear) {
    Assembler.menus.closeFolders();
    Assembler.menus.showConnectorGUI(this, type, clear);
};

Connector.prototype.removeParentFromScene = function () {
    this.manager.removeChild(this.parentPart.rootParentName());
    this.manager.saveAllPositions();
    this.manager.updateValueAndHistory();
    this.manager.redraw();
};

Connector.prototype.removeNetworkFromScene = function () {
    this.manager.removeNetworkFromScene(this);
    this.manager.saveAllPositions();
    this.manager.updateValueAndHistory();
    this.manager.redraw();
};

Connector.prototype.networkParts = function (list) {
    //lists all parts that are related to this connector, also trough other connector, recursively
    list = list || [];
    var part = this.parentPart;
    if (list.indexOf(part) > -1) return list;
    list.push(part);
    var connectors = part.connectors;
    for (var i = 0; i < connectors.length; i++) {
        if (connectors[i].isConnected) {
            connectors[i].pairConnector.networkParts(list);
        }
    }
    return list;
};

Connector.prototype.networkMeshes = function (list) {
    //lists all meshes that are related to this connector, also trough other connector, recursively
    list = list || [];
    var part = this.parentPart;
    var mesh = part.mesh;
    if (list.indexOf(mesh) > -1) return list;
    list.push(mesh);
    var connectors = part.connectors;
    for (var i = 0; i < connectors.length; i++) {
        if (connectors[i].isConnected) {
            connectors[i].pairConnector.networkMeshes(list);
        }
    }
    return list;
};

Connector.prototype.networkMeshesToTransformInADirtyConnection = function (avoid) {
    //used only with interactive connections, to move also already connected objects
    var partsList = this.networkParts();
    if (partsList.indexOf(avoid)>-1) return []; //this means that circular connections must be done with simulation
    return _.pluck(partsList,'mesh');
};

Connector.prototype.networkMinY = function () {
    return _.min(this.networkMeshes().map(
        function (mesh) {
            if  ((mesh.geometry instanceof THREE.SphereGeometry) || (mesh.geometry instanceof THREE.CylinderGeometry)){
                return mesh.position.y + -mesh.geometry.boundingSphere.radius;
            } else {
                return mesh.position.y + mesh.geometry.boundingBox.min.y;
            }
        }
    ));
};

Connector.prototype.networkRelativePositions = function () {
    this.mesh.updateMatrixWorld(true);
    var mainPos = Vec3();
    this.mesh.localToWorld(mainPos);
    return this.networkMeshes().map(function (mesh) {
        return mesh.position.clone().sub(mainPos);
    });
};

Connector.prototype.moveNetwork = function (vector, netPos) {
    this.simulator.addDirty(this.mesh.parent, vector);
    var meshes = this.networkMeshes();
    for (var i = 0; i < meshes.length; i++) {
        var _vector = vector.clone();
        this.simulator.addDirty(meshes[i], _vector.add(netPos[i]));
    }
};

Connector.prototype.interactiveMoveNetwork = function (vector, netPos, simulator) {
    simulator = simulator || this.simulator;
    var posY = this.mesh.localToWorld(Vec3()).y;
    var netMinY = this.networkMinY();
    var vecY = vector.y;
    //the final movement should avoid netMinY<0
    if ((netMinY + vecY - posY) < 0) {
        vector.y += -(netMinY + vecY - posY);
    }
    simulator.setDirty(this.mesh.parent, vector);
    var meshes = this.networkMeshes();
    for (var i = 0; i < meshes.length; i++) {
        var _vector = vector.clone();
        simulator.setDirty(meshes[i], _vector.add(netPos[i]));
    }
};

Connector.prototype.interactiveMovePart = function (vector, simulator) {
    simulator = simulator || this.simulator;
    var thisPos = this.mesh.localToWorld(Vec3());
    var partPos = this.parentPart.mesh.localToWorld(Vec3());
    var diff = thisPos.sub(partPos);
    vector.sub(diff);
    if (vector.y + this.parentPart.mesh.geometry.boundingBox.min.y < 0) {
        vector.y = -this.parentPart.mesh.geometry.boundingBox.min.y;
    }
    simulator.setDirty(this.parentPart.mesh, vector);
};