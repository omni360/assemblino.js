function Neural2_Wheels() {
    /**
     * Another neural networks test with brain.js
     *
     * The assemble is composed of a plate with 2 motored wheels and a support wheel.
     *
     * The purpose of the training is to guide the vehicle to near positions and orientations.
     *
     * Combining these small positions and rotations steps one can sum them up to larger movements.
     *
     * The training data is gathered by setting random velocities to the wheels and reading the
     * resulting displacement and orientation. Each training case has as input the position and orientation and
     * as output the wheels velocities.
     */

    var head, front, rear, controllers, boundaries = {},
        newDirection, newPosition, oldDirection, oldPosition,
        initialPositions, trainingCases = [];
    var workingRadius = 100;
    var rpmLimit = 60;
    var numCases = 200;
    var currentStep = -1;
    var testCaseSteps = 3;
    var settlingSteps = 10; //number of simulations to wait before recording the test case
    var trainingIsDone = false;
    var _this = this;
    var program = new Program(_this);
    var lastLog = 0;
    var curTarget;
    var net = new brain.NeuralNetwork();
    var useStored = false;

    program.init = function () {
        head = _this.getPart('HEAD');
        front = head.getConnector('4-0-0-0');
        rear = head.getConnector('5-0-0-0');
        saveInitialPositions();
    };
    program.step = function () {
        logCases();
        if (trainingIsDone) {
            if (isOutOfWorkingRadius()) {
                setPositionsToInitial();
            }
            followTarget();
            return;
        }
        if (useStored){
            net.fromJSON(Assemblino.manager.getData('nn'));
            _.extend(boundaries, Assemblino.manager.getData('boundaries'));
        }
        if (trainingCases.length == numCases) {
            console.log('normalizing...');
            trainingCases = normalize(trainingCases, boundaries);
            console.log('training...');
            net.train(trainingCases);
            trainingIsDone = true;
            Assemblino.manager.setData('net', net.toJSON());
            Assemblino.manager.setData('boundaries', boundaries);
            console.log('data saved!');
            setPositionsToInitial();
            console.log('finished training!');
            return;
        }
        if (!controllers && _this.getController('M1') && _this.getController('M2')) {
            controllers = [_this.getController('M1'), _this.getController('M2')];
            if (useStored){
                trainingIsDone = true;
            }
        } else if (!controllers) {
            return;
        }
        currentStep++;
        if (isOutOfWorkingRadius()) {
            setPositionsToInitial();
            currentStep = 0;
            setNextRPM();
        } else if (currentStep == settlingSteps) {
            saveCurrentPosition();
        } else if (currentStep == (settlingSteps + testCaseSteps)) {
            addTrainingCase();
            currentStep = 0;
            setNextRPM();
        }
    };

    function logCases() {
        if (!trainingCases.length) return;
        var step = Math.max(1, Math.round(numCases / 100));
        if ((trainingCases.length % step) == 0) {
            if (lastLog == trainingCases.length) return;
            lastLog = trainingCases.length;
            console.log(Math.round(100 * trainingCases.length / numCases) + " %");
        }
    }

    function saveInitialPositions() {
        //initialize
        newDirection = front.mesh.localToWorld(Vec3()).sub(rear.mesh.localToWorld(Vec3()));
        newDirection.normalize();
        newPosition = head.mesh.position.clone();
        //save initial positions and rotations for all objects
        initialPositions = _.map(_this.partsList(), function (part) {
            return {
                part: part,
                physics: part.getPhysics()
            };
        });
    }

    function setPositionsToInitial() {
        //restore the positions and rotations to their initial value
        if (!initialPositions) return;
        _.map(initialPositions, function (obj) {
            obj.part.setPhysics(obj.physics);
        });
    }

    function isOutOfWorkingRadius() {
        return head.mesh.position.length() > workingRadius;
    }

    function addTrainingCase() {
        if (!controllers) return;
        trainingCases.push({
            input: getInput(),
            output: getOutput()
        });
    }

    function saveCurrentPosition() {
        newDirection = front.mesh.localToWorld(Vec3()).sub(rear.mesh.localToWorld(Vec3()));
        newDirection.normalize();
        newPosition = head.mesh.position.clone();
    }

    function getInput() {
        oldDirection = newDirection;
        oldPosition = newPosition;
        newDirection = front.mesh.localToWorld(Vec3()).sub(rear.mesh.localToWorld(Vec3()));
        newDirection.normalize();
        newPosition = head.mesh.position.clone();
        var displacement = newPosition.clone().sub(oldPosition);
        var dot = oldDirection.dot(newDirection);
        var angle = Math.acos(dot);
        var angleSignal = oldDirection.cross(newDirection).y;
        angleSignal =
            angleSignal > 0 ? 1 :
                angleSignal < 0 ? -1 :
                    0;
        var orientation = displacement.dot(newDirection);
        orientation =
            orientation > 0 ? 1 :
                orientation < 0 ? -1 :
                    0;
        //assume rotations are small
        if (isNaN(angle)) {
            angle = 0;
        }
        return {
            a: angleSignal * angle,
            d: orientation * displacement.length()
        };
    }

    function getOutput() {
        return {
            rpm1: controllers[0].getRPM(),
            rpm2: controllers[1].getRPM()
        };
    }

    function setNextRPM() {
        _.map(controllers, function (c) {
            c.setRPM(Math.random() * rpmLimit - rpmLimit / 2);
        });
    }

    function normalize(list, boundaries) {
        list = _.shuffle(list);
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
        console.log(boundaries);
        return list;
    }

    function encodeInput(value, key, boundaries) {
        return linearTransform(value, boundaries.inputMin[key], boundaries.inputMax[key], 0, 1);
    }

    function encodeOutput(value, key, boundaries) {
        return linearTransform(value, boundaries.outputMin[key], boundaries.outputMax[key], 0, 1);
    }

    function decodeInput(value, key, boundaries) {
        return linearTransform(value, 0, 1, boundaries.inputMin[key], boundaries.inputMax[key]);
    }

    function decodeOutput(value, key, boundaries) {
        return linearTransform(value, 0, 1, boundaries.outputMin[key], boundaries.outputMax[key]);
    }

    function nextTarget() {
        return [
            {x: -30, z: -30},
            {x: -30, z: 30},
            {x: 30, z: -30},
            {x: 30, z: 30}
        ][Math.floor(4 * Math.random())];
    }

    function isClose(target, position) {
        return Math.sqrt(_.reduce(['x', 'z'], function (sum, axis) {
            return sum + Math.pow(target[axis] - position[axis], 2);
        }, 0)) < 1;
    }

    function followTarget() {
        currentStep++;
        if (currentStep<testCaseSteps){
            return;
        }
        if (!curTarget || isClose(curTarget, head.mesh.position)) {
            curTarget = nextTarget(boundaries);
            console.log('next: ', curTarget.x, curTarget.z);
            return;
        }
        currentStep = 0;
        var headDirection = front.mesh.localToWorld(Vec3()).sub(rear.mesh.localToWorld(Vec3()));
        var targetDirection = Vec3([curTarget.x, head.mesh.position.y, curTarget.z]).sub(head.mesh.position);
        var dot = headDirection.clone().normalize().dot(targetDirection.clone().normalize());
        var angle = Math.acos(dot);
        var angleSignal = headDirection.clone().cross(targetDirection).y;
        angleSignal = angleSignal > 0 ? 1 : -1;
        var orientation = headDirection.dot(targetDirection);
        orientation =
            orientation > 0 ? 1 :
                orientation < 0 ? -1 :
                    0;
        //assume rotations are small
        if (isNaN(angle)) {
            angle = 0;
        }
        var wanted = {
            a: angleSignal * angle,
            d: orientation * targetDirection.length()
        };
        wanted = limitInput(wanted, boundaries, 0.7, 0.01);
        wanted = {
            a: encodeInput(wanted.a, 'a', boundaries),
            d: encodeInput(wanted.d, 'd', boundaries)
        };
        var rpm = net.run(wanted);
        _.map(rpm, function (val, key) {
            rpm[key] = decodeOutput(val, key, boundaries);
        });
        controllers[0].setRPM(rpm.rpm1/0.7);
        controllers[1].setRPM(rpm.rpm2/0.7);
    }

    function limitInput(wanted, boundaries, dispersion, noise) {
        _.map(wanted, function (v, k) {
            var lim = (dispersion + noise*(Math.random()-0.5)) * Math.abs(boundaries.inputMax[k] - boundaries.inputMin[k]) / 2;
            if (Math.abs(v) > lim) {
                wanted[k]= v / lim;
            }
        });
        return wanted;
    }

    function limitInputBK(wanted, boundaries, dispersion, noise) {
        var segmentation = _.max(_.map(wanted, function (value, key) {
            var span = (boundaries.inputMax[key] - boundaries.inputMin[key]) * (dispersion + noise * (Math.random() - 0.5));
            var center = (boundaries.inputMax[key] + boundaries.inputMin[key]) / 2;
            var s = 0;
            if (value > center) {
                s = value / (center + span / 2);
            } else {
                s = value / (center - span / 2);
            }
            return s;
        }));
        _.map(wanted, function (v, k) {
            wanted[k] = v / segmentation;
        });
        return wanted;
    }
}