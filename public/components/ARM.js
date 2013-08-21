function ARM() {
    if (window==this) return;
    var base, tool, matrix, position, angles, lows, highs;
    var servos = [null, null, null];
    var si = Assemblino.simulator.simulationInterval;
    var mav = 60; //maximum angular velocity, per s
    var amplitude = 60;
    var curAngles = [0,0,0];
    var assemble = this;
    var subSteps = [];
    var trainCases = [];
    var limit = 2000;
    var program = new Program(assemble);
    var net = new brain.NeuralNetwork();
    program.init = function () {
        console.log('gathering data...');
        base = this.getPart('BASE');
        tool = this.getPart('TOOL');
        matrix = base.mesh.matrixWorld;
    };

    program.step = function(){
        if(trainCases.length>limit) {
            follow();
            return;
        }
        if (trainCases.length==limit){
            console.log('training...');
            train();
        }
        var angles = subSteps.shift();
        if (angles){
            addTrainCase();
            curAngles = angles;
            setAngles(curAngles);
            if ((trainCases.length % (limit/100))==0){
                console.log(Math.round(100*(trainCases.length / limit)) + "%");
            }
        } else {
            //console.log(0,curAngles);
            moreSubSteps(curAngles, nextAngles(), subSteps);
            //console.log(1,curAngles);

        }
    };
    function train (){
        trainCases = _.shuffle(trainCases);
        lows = {
            input: [1000,1000,1000],
            output: [1000,1000,1000]
        };
        highs = {
            input: [-1000,-1000,-1000],
            output: [-1000,-1000,-1000]
        };
        var o12 = [0,1,2];
        o12.map(function(i){
            _.each(trainCases, function(tc){
                lows.input[i] = Math.min(tc.input[i], lows.input[i]);
                highs.input[i] = Math.max(tc.input[i], highs.input[i]);
                lows.output[i] = Math.min(tc.output[i], lows.output[i]);
                highs.output[i] = Math.max(tc.output[i], highs.output[i]);
             });
        });
        o12.map(function(i){
        _.each(trainCases, function(tc){
                tc.input[i] = linearTransform(tc.input[i], lows.input[i], highs.input[i], 0,1);
                tc.output[i] = linearTransform(tc.output[i], lows.output[i], highs.output[i], 0,1);
            });
        });
        //console.log(lows);
        //console.log(highs);
        net.train(trainCases);
    }

    function follow(){
        if (this._running === undefined){
            this._running = true;
            console.log('applying...');
        }
        var o12 = [0,1,2];
        var xyz = ['x','y','z'];
        var low = Vec3(_.map(o12, function(i){
            return lows.input[i];
        }));
        var vec = Vec3(_.map(o12, function(i){
            var d = highs.input[i] - lows.input[i];
            var length = 0.5*(1+Math.sin(0.5 * Math.PI * Date.now()/1000));
            return d * length;
        }));
        low.add(vec);
        low = _.map(xyz, function(x, i){
            return linearTransform(low[x], lows.input[i], highs.input[i], 0, 1);
        });
        var angles = net.run(low);
        angles = _.map(angles, function(a, i){
            return linearTransform(a, 0, 1, lows.output[i], highs.output[i]);
        });
        setAngles(angles);
    }
    function addTrainCase(){
        var pos = tool.mesh.position.clone();
        base.mesh.worldToLocal(pos);
        trainCases.push({
            input: [pos.x, pos.y, pos.z],
            output: curAngles.slice()
        });
    }
    function setAngles(angles){
        for (var i = 0; i < servos.length; i++){
            if (servos[i]){
                servos[i].setAngle(angles[i]);
            } else {
                servos[i] = assemble.getController('S' + (i + 1));
            }
        }
    }
    function nextAngles(){
        return [
            Math.random() * amplitude-amplitude/2,
            Math.random() * amplitude-amplitude/2,
            Math.random() * amplitude-amplitude/2
        ];
    }
    function moreSubSteps (cur, next, subSteps){
        var max = 0, d;
        var ott = [0,1,2];
        var diff = _.map(ott, function(i){
             d = next[i] - cur[i];
             max = Math.max(Math.abs(d), max);
            return d;
        });
        //console.log(diff);
        var time = max/mav; //in secs
        var steps = Math.ceil(time*1000/si);
        //console.log('steps', steps);
        for (var s = 1; s <= steps; s++){
            subSteps.push(_.map(ott, function(i){
                return cur[i] + s * diff[i] / steps;
            }));
        }
        return subSteps;
    }
}