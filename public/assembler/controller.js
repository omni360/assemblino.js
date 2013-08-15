'use strict';

/**
 * Controller for movements, like PID
 */

function MovementController(simulator) {
    this.simulator = simulator;
    this.count = 0;
    this.reset();
}

MovementController.prototype.reset = function () {
    this.integral = Vec3();
    this.anngularIntegral = Vec3();
    this.previousError = Vec3();
    this.previousAngularError = Vec3();
    this.connector = null;
    this.target = null;
    this.mass = 0;
};

//FIXME this works for big simulation times but why ?!!
function KiT(time){
   return 0.0001 * (time/100);
}
function KpT(time){
    return 0.2 * (time/100);
}
function KdT(time){
    return 100;
}

function tT(time){
    return Math.max(time, 100);
}

MovementController.prototype.setConnector = function (connector) {
    this.connector = connector;
    this.mass = connector.parentPart.mesh._physijs.mass; //  connector.networkMass();
    var Ku = Assemblino.simulator.scaleKgForce(this.mass);
    //to control position
    //FIXME this works for big simulation times but why ?!!
    this.Kp = Ku * KpT(this.simulator.simulationInterval);
    this.Ki = Ku * KiT(this.simulator.simulationInterval);
    this.Kd = Ku * KdT(this.simulator.simulationInterval);
    //FIXME to control angular velocity !!??
    this.KpA = 0.1 * this.Kp;
    this.KiA = 0.1 * this.Ki;
    this.KdA = 0.1 * this.Kd;
};

MovementController.prototype.setTarget = function (targetVector) {
    this.target = targetVector;
};

MovementController.prototype.moveToTarget = function () {
    if (!this.connector || !this.target) return;
    //FIXME should be in secs
    var dt = tT(this.simulator.simulationInterval);
    //linear control
    var error = this.target.clone().sub(this.connector.getPosition());
    this.integral.add(error.clone().multiplyScalar(dt));
    var derivative = error.clone().sub(this.previousError).divideScalar(dt);
    var kp = error.clone().multiplyScalar(this.Kp);
    var ki = this.integral.clone().multiplyScalar(this.Ki);
    var kd = derivative.multiplyScalar(this.Kd);
    this.previousError = error.clone();
    var output = kp.add(ki).add(kd);
    this.connector.parentPart.mesh.applyCentralForce(output.clone());
    //angular control
    error = this.connector.parentPart.mesh.getAngularVelocity().clone().negate().normalize();
    this.anngularIntegral.add(error.clone().multiplyScalar(dt));
    derivative = error.clone().sub(this.previousAngularError).divideScalar(dt);
    kp = error.clone().multiplyScalar(this.KpA);
    ki = this.anngularIntegral.clone().multiplyScalar(this.KiA);
    kd = derivative.multiplyScalar(this.KdA);
    this.previousAngularError = error.clone();
    output = kp.add(ki).add(kd);
    this.connector.parentPart.mesh.applyTorque(output);
};

function periodicController(controllerName, frequence, phase) {
    if (!controllerName) return _.identity;
    var control;
    return function () {
        try {
            control || (control = this.getController(controllerName));
            if (!control) return;
            frequence = frequence || 0.1;
            phase = phase || 0;
            var type = control.settings.actuator;
            var fun = {
                motor: 'setRPM',
                servo: 'setAngle',
                linear: 'setPosition'
            }[type];
            if (!fun) return;
            var options = control.settings.options;
            var min = Math.min(options.low, options.high);
            var amplitude = Math.abs(options.low - options.high);
            control[fun](min + amplitude / 2 + (amplitude / 2) * Math.sin(phase + (2 * Math.PI * frequence) * (Date.now()) / 1000));
        } catch (e) {
        }
    };
}

