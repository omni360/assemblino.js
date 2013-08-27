'use strict';
/**
 * Interface to change constraints like motors and fixed points
 */
function Controller(options) {
    Physijs.Eventable.call(this);
    this.constraint = null;
    this.settings = _.clone(options || {});
    this.settings.actuator = this.settings.type;
    this.settings.type = Assembler.actuators.getConstraintTranslation(this.settings.type);
    var _this = this;
    function objectReady() {
        if (_this.objecta_onScene && _this.objectb_onScene) {
            _this.objectsReady = true;
            _this.dispatchEvent('objectsReady');
            _this.removeEvent('objectsReady');
            _this.settings.objecta.removeEventListener('ready', objectReady);
            _this.settings.objectb && _this.settings.objectb.removeEventListener('ready', objectReady);
        }
    }
    if (this.settings.objectb){
        this.settings.objectb.addEventListener('ready', function () {
            _this.objectb_onScene = true;
            objectReady();
        })
    } else {
        _this.objectb_onScene = true;
    }
    this.settings.objecta.addEventListener('ready', function () {
        _this.objecta_onScene = true;
        objectReady();
    });
}

Physijs.Eventable.make(Controller);

Controller.prototype.addToScene = function (scene) {
    scene = sceneOf(scene);
    this.scene = scene;
    var def = this.settings;
    var constraint = new Physijs.Constraint(_.clone(def));
    this.constraint = constraint;
    var _this = this;
    constraint.addEventListener('ready', function () {
        new Actuators(_this);
        _this.constraintReady = true;
        _this.dispatchEvent('constraintReady');
    });
    scene.addConstraint(constraint);
    return constraint;
};

Controller.prototype.selfDestroy = function(){
    this.removeConstraint();
    this.removeAllEvents();
    this._actuatorObject && this._actuatorObject.selfDestroy();
    destroyObject(this.settings);
    destroyObject(this);
};

Controller.prototype.removeConstraint = function () {
    this.scene.removeConstraint(this.constraint);
    Assembler.menus.removeControllerGUI(this);
    if (this.system){
        this.system.controllers = _.without(this.system.controllers, this);
    }
};

Controller.prototype.getName = function(){
    return this.settings && this.settings.name;
};

//it does not need to be a class
function Actuators (controller){
    if (controller){
        this.controller = controller;
        controller._actuatorObject = this;
        this.type = controller.settings.type;
        this.actuator = controller.settings.actuator;
        this.options = _.defaults(controller.settings.options || {},this.DEFAULTS[this.actuator]);
        this.interfaceBuilder = this.FUNCTIONS[this.actuator];
        this.interfaceBuilder && this.interfaceBuilder(controller);
        if (controller.settings.options.gui){
            this.guiBuilder = this.GUI[this.actuator];
            this.guiBuilder && Assembler.menus.addActuatorGUI(this, this.guiBuilder);
        }
        this.info = this.INFO[this.actuator];
    }
}

Actuators.prototype.selfDestroy = function(){
    destroyObject(this);
};

Actuators.prototype.GUI = {};
Actuators.prototype.FUNCTIONS = {};
Actuators.prototype.DEFAULTS = {};
Actuators.prototype.INFO = {};

Actuators.prototype.constraintConstructors = {
    hinge: Physijs.HingeConstraint,
    motor: Physijs.HingeConstraint,
    servo: Physijs.HingeConstraint,
    slider: Physijs.SliderConstraint,
    linear: Physijs.SliderConstraint,
    point: Physijs.DOFConstraint,
    dof: Physijs.DOFConstraint,
    fix: Physijs.HingeConstraint
};

Actuators.prototype.constraintDictionary = {
    hinge: 'hinge',
    motor: 'hinge',
    servo: 'hinge',
    slider: 'slider',
    linear: 'slider',
    point: 'dof',
    fix: 'hinge'
};

Actuators.prototype.getConstraintConstructor = function (type){
    return this.constraintConstructors[type];
};

Actuators.prototype.getConstraintTranslation = function (type){
    return this.constraintDictionary[type];
};

Actuators.prototype.getConstraintKeys = function (){
    return _.keys(this.constraintDictionary);
};

Actuators.prototype.getDefaults = function (actuator){
    return Actuators.prototype.DEFAULTS[actuator];
};

Actuators.prototype.getInfo = function (actuator){
    return (Actuators.prototype.INFO[actuator] || "") + "\n\n" + Assembler.simulator.getScaleInfo();
};

Actuators.prototype.DEFAULTS['slider'] = {
    low: -10,
    high: 10,
    mirror: false,
    offset: 0
};

Actuators.prototype.INFO['slider'] = "" +
    "The slider travels along the connectors y/green axis, between the distances defined by low and high." +
    "\nMirror will make parts connect with the y/green axis opposed." +
    "\nOffset influences the initial position." +
    "\nsetting the value of low superior to high will make the slider travel without boundaries.";

Actuators.prototype.FUNCTIONS['slider'] = function (controller) {
    var settings = this.options;
    controller.enable = function () {
        controller.isEnabled = true;
        controller.constraint.setLimits(settings.low,settings.high,0,0);
        controller.constraint.disableLinearMotor();
    };
    controller.disable = function () {
        controller.isEnabled = false;
        controller.constraint.setLimits(1,0,0,0);
        controller.constraint.disableLinearMotor();
    };
    controller.constraint.setRestitution(0.3,0);
    controller.enable();
};

Actuators.prototype.INFO['hinge'] = "" +
    "The hinge allows free rotation around the connectors y/green axis" +
    "\nMirror will make parts connect with the y/green axis opposed." +
    "\nOffset influences the initial position along the y axis.";

Actuators.prototype.DEFAULTS['hinge'] = {
    mirror: false,
    offset: 0
};

Actuators.prototype.FUNCTIONS['hinge'] = function (controller) {
    controller.enable = function () {
        controller.isEnabled = true;
        controller.constraint.setLimits(1,0,0,0);
        controller.constraint.disableMotor();
    };
    controller.free = function () {
        controller.isEnabled = false;
        controller.constraint.setLimits(1,0,0,0);
        controller.constraint.disableMotor();
    };
    controller.enable();
};

Actuators.prototype.DEFAULTS['servo'] = {
    rpm: 200,
    torque: 5, //Kg.cm if scale is cm or Kg.m if its meter
    isEnabled: true,
    angle: 0,
    low: -90,
    high: 90,
    mirror: false,
    offset: 0,
    angleOffset: 0,
    gui: true
};

Actuators.prototype.INFO['servo'] = "" +
    "The servo allows motorized rotation along the connectors y/green axis, between the angles defined by low and high." +
    "\nThe angle of rotation (in degrees) can be defined and changed." +
    "\nRpm and Torque are the speed of rotation and the associated torque." +
    "\nMirror will make parts connect with the y/green axis opposed." +
    "\nOffset influences the connectors relative position along y, i.e. a translation along this axis." +
    "\nAngle offset defines the angle bias. When angle is set to 0 the shaft rotation will match the Angle Offset.";

Actuators.prototype.FUNCTIONS['servo'] = function (controller) {
    //values
    var settings = this.options;

    controller.setAngle = function (value) {
        //validation
        value = Math.min(value, settings.high);
        value = Math.max(value, settings.low);
        settings.angle = value;
        if (!settings.isEnabled) return;
        controller.constraint.setLimits(
            Assembler.simulator.scaleAngle(value + settings.angleOffset),
            Assembler.simulator.scaleAngle(value+ settings.angleOffset)
        );
        controller.constraint.enableAngularMotor(
            Assembler.simulator.scaleRPM(settings.rpm),
            Assembler.simulator.scaleTorque(settings.torque)
        );
    };
    controller.enable = function () {
        settings.isEnabled = true;
        controller.constraint.setLimits(
            Assembler.simulator.scaleAngle(settings.angle + settings.angleOffset),
            Assembler.simulator.scaleAngle(settings.angle + settings.angleOffset)
        );
        controller.constraint.enableAngularMotor(
            Assembler.simulator.scaleRPM(settings.rpm),
            Assembler.simulator.scaleTorque(settings.torque)
        );
    };
    controller.disable = function () {
        settings.isEnabled = false;
        controller.constraint.disableMotor();
    };
    controller.getAngle = function () {
        return settings.angle;
    };
    controller.isEnabled = function () {
        return settings.isEnabled;
    };
    controller.getLow = function (){
        return settings.low;
    };
    controller.getHigh = function (){
        return settings.high;
    };
    if (settings.isEnabled){
        controller.enable();
    } else {
        controller.disable();
    }
};
Actuators.prototype.GUI['servo'] = function (controller, folder) {
    var settings = this.options;
    folder.onClick(motor);
    var gui = folder.add(settings, 'angle',
        settings.low, settings.high, 1);
    gui.onChange(motor);
    controller.gui = gui;
    function motor(value) {
        if (value === false) {
            settings.isEnabled = false;
            controller.constraint.setLimits(
                Assembler.simulator.scaleAngle(settings.low + settings.angleOffset),
                Assembler.simulator.scaleAngle(settings.high + settings.angleOffset)
            );
            controller.constraint.disableMotor();
        } else if (value === true) {
            settings.isEnabled = true;
            controller.constraint.setLimits(
                Assembler.simulator.scaleAngle(settings.angle + settings.angleOffset),
                Assembler.simulator.scaleAngle(settings.angle + settings.angleOffset)
            );
            controller.constraint.enableAngularMotor(
                Assembler.simulator.scaleRPM(settings.rpm),
                Assembler.simulator.scaleTorque(settings.torque)
            );
        } else if (settings.isEnabled) {
            settings.angle = value;
            controller.constraint.setLimits(
                Assembler.simulator.scaleAngle(settings.angle + settings.angleOffset),
                Assembler.simulator.scaleAngle(settings.angle + settings.angleOffset)
            );
            controller.constraint.enableAngularMotor(
                Assembler.simulator.scaleRPM(settings.rpm),
                Assembler.simulator.scaleTorque(settings.torque)
            );
        }
    }
    if (settings.isEnabled){
        if (folder.closed) folder.open();
    } else {
        if (!folder.closed) folder.close();
    }
};

Actuators.prototype.DEFAULTS['motor'] = {
    rpm: 1,
    torque: 5,
    isEnabled: false,
    low: -300,
    high: 300,
    mirror: false,
    reverse: false,
    offset: 0,
    gui: true
};

Actuators.prototype.INFO['motor'] = "" +
    "The motor allows motorized rotation along the connectors y/green axis, with velocities between by low and high." +
    "\nThe velocity of rotation can be defined and changed." +
    "\nRpm and Torque are the initial speed of rotation and the associated force." +
    "\nMirror will make parts connect with the y/green axis opposed." +
    "\nReverse has influence on the sense of rotation." +
    "\nOffset influences the connectors relative position along y, i.e. a translation along this axis." +
    "\nlow and high are the maximum velocities in both direction.";

Actuators.prototype.FUNCTIONS['motor'] = function (controller) {
    var settings = this.options;
    controller.setVelocity = controller.setRPM = function (value) {
        //validation
        value = Math.min(value, settings.high);
        value = Math.max(value, settings.low);
        settings.rpm = value;
        if (!settings.isEnabled) return;
        controller.constraint.enableAngularMotor(
            (settings.reverse ? -1 : 1) * Assembler.simulator.scaleRPM(settings.rpm),
            Assembler.simulator.scaleTorque(settings.torque)
        );
    };
    controller.getVelocity = controller.getRPM = function(){
         return settings.rpm;
    };
    controller.enable = function () {
        controller.isEnabled = true;
        controller.constraint.setLimits(1, 0);
        controller.constraint.enableAngularMotor(
            (settings.reverse ? -1 : 1) * Assembler.simulator.scaleRPM(settings.rpm),
            Assembler.simulator.scaleTorque(settings.torque)
        );
    };
    controller.disable = function () {
        settings.isEnabled = false;
        controller.constraint.setLimits(1, 0);
        controller.constraint.disableMotor();
    };
    controller.getLow = function (){
        return settings.low;
    };
    controller.getHigh = function (){
        return settings.high;
    };
    if (settings.isEnabled){
        controller.enable();
    } else {
        controller.disable();
    }
};

Actuators.prototype.GUI['motor'] = function (controller, folder) {
    var settings = this.options;
    folder.onClick(motor);
    folder.add(settings, 'rpm',
        settings.low, settings.high, 0.01).onChange(motor);
    function motor(value) {
        if (value === false) {
            settings.isEnabled = false;
            controller.constraint.setLimits(
                1,
                0
            );
            controller.constraint.disableMotor();
        } else if (value === true) {
            settings.isEnabled = true;
            controller.constraint.setLimits(
                1,
                0
            );
            controller.constraint.enableAngularMotor(
                (settings.reverse ? -1 : 1) * Assembler.simulator.scaleRPM(settings.rpm),
                Assembler.simulator.scaleTorque(settings.torque)
            );
        } else if (settings.isEnabled) {
            settings.rpm = value;
            controller.constraint.setLimits(
                1,
                0
            );
            controller.constraint.enableAngularMotor(
                (settings.reverse ? -1 : 1) * Assembler.simulator.scaleRPM(settings.rpm),
                Assembler.simulator.scaleTorque(settings.torque)
            );
        }
    }
    if (settings.isEnabled){
        if (folder.closed) folder.open();
    } else {
        if (!folder.closed) folder.close();
    }
};

Actuators.prototype.DEFAULTS['fix'] = {
    mirror: false,
    offset: 0,
    angle: 0
};

Actuators.prototype.INFO['fix'] = "" +
    "This fixes both parts relative to each other without any degrees of freedom." +
    "\nMirror will make parts connect with the y/green axis opposed." +
    "\nAngle changes the initial relative rotation between both connectors." +
    "\nOffset influences the position defined by y=0, i.e. a translation along this axis." ;

Actuators.prototype.FUNCTIONS['fix'] = function (controller) {
    var force = 1000;
    var settings = this.options;
    controller.fix = function () {
        settings.isEnabled = true;
        controller.constraint.setLimits(
            Assembler.simulator.scaleAngle(settings.angle),
            Assembler.simulator.scaleAngle(settings.angle)
        );
        controller.constraint.enableAngularMotor(0, Assembler.simulator.scaleKgForce(force));
    };
    controller.loose = function () {
        settings.isEnabled = false;
        controller.constraint.setLimits(1, 0);
        controller.constraint.disableMotor();
    };
    controller.fix();
};

Actuators.prototype.DEFAULTS['point'] = {
    offset: 0
};

Actuators.prototype.INFO['point'] = "" +
    "Creates a point constraint. Bodies are free to rotate but their positions are limited by matching the connectors." +
    "\nOffset translates one of the connectors along the y/green axis." ;

Actuators.prototype.DEFAULTS['linear'] = {
    velocity: 10,
    force: 8,
    low: 0,
    high: 10,
    position: 0.0,
    mirror: false,
    isEnabled: false,
    gui: true
};

Actuators.prototype.INFO['linear'] = "" +
    "The linear motor constraint allows the relative and motorized movement of both parts along the y/green axis." +
    "\nThe position can be defined and changed." +
    "\nVelocity and Force are the speed of travel and the associated force." +
    "\nMirror will make parts connect with the y/green axis opposed." +
    "\\nSetting the value of low superior to high will allow rotation without boundaries.";

Actuators.prototype.FUNCTIONS['linear'] = function (controller) {
    var settings = this.options;
    controller.setPosition = function (value) {
        //validation
        value = Math.min(value, settings.high);
        value = Math.max(value, settings.low);
        settings.position = value;
        if (!settings.isEnabled) return;
        controller.constraint.setLimits(
            value,
            value,0,0
        );
        controller.constraint.enableLinearMotor(settings.velocity, Assembler.simulator.scaleKgForce(settings.force));
    };
    controller.getPosition = function (){
         return settings.position;
    };
    controller.getLow = function (){
        return settings.low;
    };
    controller.getHigh = function (){
        return settings.high;
    };
    controller.isEnabled = function (){
        return settings.isEnabled;
    };
    controller.enable = function () {
        settings.isEnabled = true;
        controller.constraint.setLimits(
            settings.position,
            settings.position,0,0
        );
        controller.constraint.enableLinearMotor(settings.velocity, Assembler.simulator.scaleKgForce(settings.force));
    };
    controller.disable = function () {
        controller.isEnabled = false;
        controller.constraint.disableLinearMotor();
    };
    //disable rotations
    controller.constraint.setLimits(
        settings.position,
        settings.position,0,0
    );
    controller.constraint.setRestitution(0.3,0);
    if (settings.isEnabled){
       controller.enable();
    } else {
       controller.disable();
    }
};

Actuators.prototype.GUI['linear'] = function (controller, folder) {
    var settings = this.options;
    folder.onClick(motor);
    var position = 'position';
    folder.add(settings, position,
        settings.low, settings.high, 0.01).onChange(motor);

    function motor(value) {
        if (value === false) {
            settings.isEnabled = false;
            controller.constraint.disableLinearMotor();
        } else if (value === true) {
            settings.isEnabled = true;
            controller.constraint.setLimits(
                settings[position],
                settings[position], 0, 0
            );
            controller.constraint.enableLinearMotor(settings.velocity, Assembler.simulator.scaleKgForce(settings.force));
        } else if (settings.isEnabled) {
            settings[position] = value;
            controller.constraint.setLimits(
                value,
                value, 0, 0
            );
            controller.constraint.enableLinearMotor(settings.velocity, Assembler.simulator.scaleKgForce(settings.force));
        }
    }
    controller.constraint.setLimits(
        settings.position,
        settings.position,0,0
    );
    if (settings.isEnabled){
        if (folder.closed) folder.open();
    } else {
        if (!folder.closed) folder.close();
    }
};
