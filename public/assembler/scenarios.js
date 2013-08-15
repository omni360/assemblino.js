'use strict';

//TODO wrap it
var SCENARIOS;
var TEXTURE_FOLDER = "../static/images/";

function Scenario() {
    this.ground = null;
    this.lights = null;
    this.axes = null;
}

function DeskScenario() {
    this.ground = null;
    this.lights = null;
    this.axes = null;
}

_.defaults(DeskScenario.prototype, Scenario.prototype);

DeskScenario.prototype.backgroundColor = "#ecf0f1";

DeskScenario.prototype.gravity = -9.81;

DeskScenario.prototype.makeLights = function () {
    if (this.lights) return null;
    this.lights = [];
    var options = {
        distance: 150,
        color: 0xFFFFFF,
        target: Vec3(0, 0, 0)
    };
    //Ambient
    //options.scene.add(new THREE.AmbientLight(0x222222));
    //Directional light with shadow
    var light = new THREE.DirectionalLight(options.color);
    light.position.set(0.35 * options.distance, options.distance * 2, -0.25 * options.distance);
    light.target.position.copy(options.target);
    var factor = 3; //experimental variable
    if (light.castShadow = RENDER_SHADOWS) {
        light.shadowCameraLeft = -factor * options.distance;
        light.shadowCameraTop = -factor * options.distance;
        light.shadowCameraRight = factor * options.distance;
        light.shadowCameraBottom = factor * options.distance;
        light.shadowCameraNear = options.distance;
        light.shadowCameraFar = 10 * factor * options.distance;
        //light.shadowBias = -.0003;
        light.shadowMapWidth = light.shadowMapHeight = 1024;
        light.shadowDarkness = .35;
    }
    this.lights.push(light);
    //light without shadow
    var otherLight = new THREE.DirectionalLight(options.color, 0.8);
    var pos2 = Vec3(options.distance, options.distance * 2, -options.distance);
    pos2.negate();
    pos2.y = 0;
    pos2.multiplyScalar(3);
    otherLight.position.copy(pos2);
    otherLight.target.position.copy(options.target);
    otherLight.castShadow = false;
    this.lights.push(otherLight);
    return this.lights;
};

DeskScenario.prototype.makeAxes = function () {
    if (this.axes) return null;
    var options = {
        scale: 100.0,
        x: 0.0,
        y: 0.0,
        z: 0.0
    };
    var object = new THREE.AxisHelper(options.scale);
    object.position.set(options.x, options.y, options.z);
    this.axes = object;
    return object;
};

DeskScenario.prototype.makeGround = function (options) {
    var defaults = {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'wood.jpg'), transparent: true}),
        //material: new THREE.MeshLambertMaterial({color: 0x555555, transparent: true}),
        //material: new THREE.MeshLambertMaterial({color: 0x456789}),
        friction: 10,
        restitution: 0.0,
        y: 0,
        gravity: -9.82,
        width: 300,
        depth: 300,
        height: 10,
        segments: 10,
        opacity: 0.9
    };
    options = _.defaults(options || {}, defaults);
    if (options.material.map) {
        options.material.map.wrapS = options.material.map.wrapT = THREE.RepeatWrapping;
        options.material.map.repeat.set(3, 3);
        options.material.opacity = options.opacity;
    }
    var material = Physijs.createMaterial(
        options.material,
        options.friction,
        options.restitution
    );
    var ground = new Physijs.BoxMesh(
        new THREE.CubeGeometry(options.width, options.height, options.depth, options.segments, 1, options.segments),
        material,
        0 // mass
    );
    ground.position.set(0, options.y - options.height / 2, 0);
    ground.receiveShadow = true;
    this.ground = ground;
    return ground;
};


function GrassScenario() {
}

_.defaults(GrassScenario.prototype, DeskScenario.prototype);

GrassScenario.prototype.backgroundColor = "#000000";

GrassScenario.prototype.makeGround = function (options) {
    var defaults = {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'grass.jpg')}),
        //material: new THREE.MeshLambertMaterial({color: 0x550033}),
        friction: 5,
        restitution: 0.4,
        y: -7,
        width: 600,
        depth: 500,
        height: 7,
        segmentsX: 20,
        segmentsY: 20,
        period: 30,
        opacity: 1.0
    };
    options = _.defaults(options || {}, defaults);
    if (options.material.map) {
        options.material.map.wrapS = options.material.map.wrapT = THREE.RepeatWrapping;
        options.material.map.repeat.set(5, 5);
        //options.material.opacity = options.opacity;
    }
    var material = Physijs.createMaterial(
        options.material,
        options.friction,
        options.restitution
    );
    var ground_geometry = new THREE.PlaneGeometry(options.width, options.depth, options.segmentsX, options.segmentsY);
    for (var i = 0; i < ground_geometry.vertices.length; i++) {
        var vertex = ground_geometry.vertices[i];
        vertex.z = Math.sin(Math.sqrt(vertex.x * vertex.x + 2 * vertex.y * vertex.y) / options.period) * options.height;
    }
    ground_geometry.computeFaceNormals();
    ground_geometry.computeVertexNormals();
    ground_geometry.computeBoundingBox();

    var ground = new Physijs.HeightfieldMesh(
        ground_geometry,
        material,
        0, // mass
        options.segmentsX,
        options.segmentsY
    );

    ground.position.set(0, options.y, 0);
    ground.rotation.x = -Math.PI / 2;

    ground.receiveShadow = true;
    this.ground = ground;
    return ground;
};

function StoneScenario() {
}

_.defaults(StoneScenario.prototype, DeskScenario.prototype);

StoneScenario.prototype.makeGround = function (options) {
    options = options || {};
    options = _.extend(options, {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'rocks.jpg'), transparent: true}),
        width: 750,
        depth: 750
    });
    return DeskScenario.prototype.makeGround.call(this, options);
};

function PlainScenario() {
}

_.defaults(PlainScenario.prototype, DeskScenario.prototype);

PlainScenario.prototype.backgroundColor = "#000000";

PlainScenario.prototype.makeGround = function (options) {
    options = options || {};
    options = _.extend(options, {
        material: new THREE.MeshBasicMaterial({wireframe: false, transparent: true, color: 0xffffff, opacity: 0.65}),
        width: 200,
        depth: 200,
        segments: 1,
        height: 1
    });
    return DeskScenario.prototype.makeGround.call(this, options);
};

function SandScenario() {
}

_.defaults(SandScenario.prototype, GrassScenario.prototype);

SandScenario.prototype.backgroundColor = "#000000";

SandScenario.prototype.makeGround = function (options) {
    options = options || {};
    options = _.extend(options, {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'sand.jpg')}),
        height: 12,
        period: 15,
        width: 1200,
        depth: 1000,
        y: -2,
        segmentsX: 30,
        segmentsY: 30    });
    return GrassScenario.prototype.makeGround.call(this, options);
};

function MoonScenario() {
}

_.defaults(MoonScenario.prototype, GrassScenario.prototype);

MoonScenario.prototype.backgroundColor = "#000000";

MoonScenario.prototype.gravity = -1.622;

MoonScenario.prototype.makeGround = function (options) {
    options = options || {};
    options = _.extend(options, {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'moon.jpg')}),
        height: 6,
        period: 30,
        width: 800,
        depth: 800,
        y: -1,
        segmentsX: 20,
        segmentsY: 20
    });
    return GrassScenario.prototype.makeGround.call(this, options);
};

function PaperScenario() {
}

_.defaults(PaperScenario.prototype, DeskScenario.prototype);

PaperScenario.prototype.makeGround = function (options) {
    options = options || {};
    options = _.extend(options, {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'paper.jpg'), transparent: true}),
        width: 750,
        depth: 750,
        height: 0.1
    });
    return DeskScenario.prototype.makeGround.call(this, options);
};

function PlyScenario() {
}

_.defaults(PlyScenario.prototype, DeskScenario.prototype);

PlyScenario.prototype.makeGround = function (options) {
    options = options || {};
    options = _.extend(options, {
        material: new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture(TEXTURE_FOLDER + 'plywood.jpg'), transparent: true}),
        width: 750,
        depth: 750,
        height: 100
    });
    return DeskScenario.prototype.makeGround.call(this, options);
};

function SpaceScenario() {
}

_.defaults(SpaceScenario.prototype, DeskScenario.prototype);

SpaceScenario.prototype.backgroundColor = "#000000";

SpaceScenario.prototype.gravity = 0;

SpaceScenario.prototype.makeGround = function () {
    return {};
};

SCENARIOS = {
    'plain': PlainScenario,
    'desk': DeskScenario,
    'grass': GrassScenario,
    'stone': StoneScenario,
    'sand': SandScenario,
    'moon': MoonScenario,
    'paper': PaperScenario,
    'space': SpaceScenario
};