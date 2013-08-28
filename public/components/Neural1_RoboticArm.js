function Neural1_RoboticArm() {
    /**
     * This is a test with the brain.js neural network library.
     *
     * The robot arm is trained by assigning arbitrary angles to the servos and taking records of these angles and the resulting
     * tool tip (red) position.
     *
     * Each test case has as input the tool tip position and as output the servo angles, to reflect a normal situation when
     * we want to move the servo tool tip to a certain position, controlling the servo angles.
     *
     * After all the data is collected, in this example just with some hundred cases (very few, takes less than a minute), the neural network is
     * used to send the too tip to the position where the blue reference point is placed.
     *
     */
    var base, tool, reference, matrix, position, angles, lows, highs;
    var simulationInterval = Assemblino.simulator.simulationInterval;
    var maxAngularVelocity = 60; //maximum angular velocity, per second
    var amplitude = 60;
    var assemble = this;
    var subSteps = [];
    var numberOfTrainingCases = 1000;
    var program = new Program(assemble);
    var net = new brain.NeuralNetwork();

    program.init = function () {
        console.log('gathering data...');
        base = this.getPart('BASE');
        tool = this.getPart('TOOL');
        reference = this.getPart('REF');
        reference.setPosition(Vec3());
        matrix = base.mesh.matrixWorld;
    };

    program.step = function(){
        net.logProgression(numberOfTrainingCases);
        if(net._isTrainned) {
            runCircularTest();
            return;
        }
        //check if servos are accessible
        if (!servosAreAccessible()) return;
        //if the training cases limit is reached, train the network
        if (net.hasEnoughData(numberOfTrainingCases)){
            console.log('training...');
            net.normalize();
            net.train(net.list);
            net._isTrainned = true;
        }
        //get the next sub step to move on to
        net.addTrainingCase(getInput(), getOutput());
        var angles = subSteps.shift();
        if (angles){
            //set the next position
            setAngles(angles);
        } else { //if no more sub steps exist, generate new ones
            moreSubSteps(subSteps);
        }
    };

    function runCircularTest(){
        if (net._running === undefined){
            net._running = true;
            console.log('running...');
        }
        var time = Date.now()/1000;
        //input is already normalized (0.2..0.8)
        var input = {
            x: 0.5 + 0.3*Math.sin(0.2222 * 2 * Math.PI * time),
            y: 0.5 + 0.3*Math.sin(0.1111 * 2 * Math.PI * time),
            z: 0.5 + 0.3*Math.sin(0.3333 * 2 * Math.PI * time)
        };
        var worldPosition = base.mesh.localToWorld(Vec3(net.decodeInput(input)));
        reference.setPosition(worldPosition);
        var output = net.run(input);
        var angles = net.decode(output);
        setAngles(angles);
    }

    function getInput(){
        //get the tool tip x,y,z position in relation to the base
        var pos = tool.mesh.position.clone();
        base.mesh.worldToLocal(pos);
        return _.pick(pos, 'x','y','z');
    }
    function getOutput(){
        //get the servos angles
        var ret = {};
        _.map(['S1','S2','S3'], function(name){
            var controller = assemble.getController(name);
            if (controller){
                ret[name] = controller.getAngle();
            }
        });
        return ret;
    }

    function servosAreAccessible(){
        return !!_.min(_.map(['S1','S2','S3'], function(name){
            return assemble.getController(name) && 1 || 0;
        }));
    }

    function setAngles(angles){
        _.map(['S1','S2','S3'], function(name){
            var controller = assemble.getController(name);
            if (controller){
                controller.setAngle(angles[name]);
            }
        });
    }
    function randomAngles(){
        return {
            S1: randomValue(-amplitude/2, amplitude/2),
            S2: randomValue(-amplitude/2, amplitude/2),
            S3: randomValue(-amplitude/2, amplitude/2)
        };
    }
    function moreSubSteps (subSteps){
        //generate a list of gradual angles to move on, between cur and next
        var cur = getOutput();
        var next = randomAngles();
        //maximum angular displacement
        var maxAngularDisplacement = _.max(_.map(cur, function(value, key){
            return Math.abs(next[key] - value);
        }));
        //number of steps required to respect the maximum velocity
        var steps = Math.max(1, Math.round((maxAngularDisplacement/maxAngularVelocity)*(1000/simulationInterval)));
        for (var s = 1; s <= steps; s++){
            subSteps.push({
                S1: linearTransform(s, 0, steps, cur.S1, next.S1),
                S2: linearTransform(s, 0, steps, cur.S2, next.S2),
                S3: linearTransform(s, 0, steps, cur.S3, next.S3)
            });
        }
        return subSteps;
    }
}