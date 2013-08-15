
OperationsManager.prototype.partTemplate = function (name) {
    var code = "" + fun;
    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
    code = code.replace(/<name>/igm, name);
    code = code.replace('<user>', (this.servedDatabase.getUsername() || ""));
    code = code.replace('<data>', formatedTime());
    code = code.replace(/\n            /mg, '\n  ');
    code = code.replace(/\n        /mg, '\n');
    return code;

    function fun() {/*
     <name>

     <user>

     <data>
     */
        var part = new Part();

        //get options from the arguments and include defaults
        var options = _.defaults(arguments[0] || {}, {
            name: nextName('<name>'), //its important to include the name
            mass: 0.1, //Kg
            topColor: 0x228855,
            someColor: randomColor(),
            size: 5 //units are defined in Settings»Simulation»Scale
        });
        //save options
        part.setOptions(options);

        //first body added will be the center of mass and concentrate all mass
        part.addBody({
            mass: options.mass, //always define the mass for the first body
            material: 'plastic', //use a material template
            color: options.someColor, //get color from options
            shape: 'sphere', //sphere, box, cylinder
            diameter: options.size,
            y: options.size / 2 //initial position
        });

        //second composite body
        part.addBody({
            material: 'metal',
            shape: 'box',
            size: options.size / 2,
            x: options.size / 2
        });

        //dressing=only aesthetics, no physics
        var dress = part.addDress({
            color: options.topColor,
            shape: 'sphere',
            radius: options.size / 4,
            z: -options.size / 2
        });

        //connectors allow assembling motors and other constraints
        part.addConnector({
            name: 'top', //recommendable to assign some name
            base: [0, options.size / 2, 0], //[x,y,z] relative position of the origin
            up: [0, 1, 0], //direction for the green/main axis
            front: [1, 0, 0], //direction for the blue/auxiliar axis
            prefer: 'servo', //prefer this constraint
            accept: ['fix', 'point', 'hinge', 'motor', 'servo'] //constraints accepted
        });

        //second connector
        part.addConnector({
            name: 'side', //assign different names to connectors in the same part
            base: [0, 0, options.size / 2], //vectors can be represented by arrays [x,y,z]
            up: [0, 0, 1],
            front: [0, 1, 0],
            prefer: 'fix',
            accept: ['fix', 'point', 'hinge']
        });
        //you don't need always a program. if not needed, simply don't declare it and save computing resources
        //Call the program constructor with the part as argument
        var program = new Program(part);
        //other assignable functions: init, step, afterDraw
        program.beforeDraw = function () {
            dress.scale.z = dress.scale.y = dress.scale.x = 1.3 + 0.3 * Math.sin(Date.now() / 1000);
        };
        //mouse click. simple * means on this part click. Connection Mode must be disabled to trigger this event
        program.mouse['*'] = function () {
            dress.material.color.set(randomColor());
        };
        //keyboard events, Code Editor must be hidden to be triggered
        //+ before the name of key means on key press, - before the name of key means on key up
        program.keys['+a'] = program.keys['-s'] = function () {
            dress.material.color.set(randomColor());
        };
        //finally
        return part;
    }
};


OperationsManager.prototype.systemTemplate = function (name) {
    var code = "" + fun;
    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
    code = code.replace(/<name>/igm, name);
    code = code.replace('<user>', (this.servedDatabase.getUsername() || ""));
    code = code.replace('<data>', formatedTime());
    code = code.replace(/\n            /mg, '\n  ');
    code = code.replace(/\n        /mg, '\n');
    return code;

    function fun() {/*
     <name>

     <user>

     <data>
     */
        var options = _.defaults(arguments[0] || {}, {
            name: nextName('<name>'), //name should always be somehow defined
            color: randomColor(),
            force: 5,
            torque: 5,
            size: 10,
            mass: 0.1
        });
        //the object to return
        var system = new System();
        //important save the options
        system.setOptions(options);

        //create and add a part
        var box = new Part({
            name: 'BOX',
            mass: options.mass / 2,
            material: 'plastic',
            shape: 'box',
            color: options.color,
            size: options.size,
            y: options.size / 2 //the origin of the box is at its center
        });
        //add a mesh without physical interaction
        box.addDress({
            material: 'plastic',
            shape: 'cylinder',
            color: 0x333333,
            diameter: options.size / 3,
            height: options.size * 3,
            y: options.size * 1.1
        });
        box.addConnector({
            name: 'top',
            base: [0, options.size / 2, 0]
        });
        box.addConnector({
            name: 'side',
            base: [0, 0, options.size / 2],
            up: [0, 0, 1]
        });
        box.addConnector({
            name: 'aux',
            base: [options.size / 2, 0, 0],
            up: [-1, 0, 0],
            front: [0, 1, 0],
            prefer: 'fix',
            accept: ['fix', 'hinge']
        });
        system.add(box);

        //create more parts
        var ball = new Part({
            name: 'BALL',
            mass: options.mass / 2,
            material: 'plastic',
            shape: 'sphere',
            color: options.color,
            size: options.size,
            y: options.size * 1.5
        });
        ball.addConnector({
            name: 'bottom',
            base: [0, -options.size / 2, 0]
        });
        system.add(ball);

        var smallBox = new Part({
            name: 'SMALL',
            mass: options.mass / 2,
            material: 'plastic',
            shape: 'box',
            color: options.color,
            size: options.size / 2,
            y: options.size / 2, //the origin of the box is at its center
            z: 3 * options.size / 4
        });
        var mesh = smallBox.addDress({
            material: 'plastic',
            shape: 'sphere',
            color: 0x333333,
            diameter: options.size / 3,
            y: options.size / 4
        });
        smallBox.addConnector({
            name: 'side',
            base: [0, 0, -options.size / 4],
            up: [0, 0, 1]
        });
        smallBox.addConnector({
            name: 'external',
            base: [0, 0, options.size / 4],
            up: [0, 0, 1],
            prefer: 'fix',
            accept: ['fix', 'hinge']
        });
        system.add(smallBox);

        /* join takes 2 objects as arguments
         the 1st just to define the parts and connectors
         the 2nd specific options for the connection
         */
        //ball box connection
        system.join({
            fixed: 'BOX',
            moved: 'BALL',
            fixedIndex: 'top',
            movedIndex: 'bottom'
        }, {
            name: "LINEAR",
            type: 'linear',
            isEnabled: true,
            velocity: 10,
            force: options.force,
            position: options.size / 3,
            low: 0,
            high: options.size
        });
        //small box to box
        system.join({
            fixed: 'BOX',
            moved: 'SMALL',
            fixedIndex: 'side',
            movedIndex: 'side'
        }, {
            name: "SERVO",
            type: 'servo',
            low: -90,
            high: 90,
            isEnabled: true,
            rpm: 200,
            torque: options.torque
        });

        //programs
        var program = new Program(system);
        //clicking the main box
        program.mouse['*'] = function () {
            mesh.material.color.set(randomColor());
        };
        //on space key up
        program.keys['-space'] = function () {
            mesh.material.color.set(randomColor());
        };
        //when pressing right increase the angle
        program.keys['+right !left'] = function () {
            var servo = this.getController('SERVO');
            var position = servo.getAngle();
            var high = servo.getHigh();
            position = Math.min(position + 10, high);
            servo.setAngle(position);
            if (!servo.isEnabled()) servo.enable();
        };
        //vice versa
        program.keys['!right +left'] = function () {
            var servo = this.getController('SERVO');
            var position = servo.getAngle();
            var low = servo.getLow();
            position = Math.max(position - 10, low);
            servo.setAngle(position);
            if (!servo.isEnabled()) servo.enable();
        };
        //controll the linear motor with up down keys
        program.keys['+up !down'] = function () {
            var linear = this.getController('LINEAR');
            var position = linear.getPosition();
            var high = linear.getHigh();
            position = Math.min(position + 1, high);
            linear.setPosition(position);
            if (!linear.isEnabled()) linear.enable();
        };
        program.keys['!up +down'] = function () {
            var linear = this.getController('LINEAR');
            var position = linear.getPosition();
            var low = linear.getLow();
            position = Math.max(position - 1, low);
            linear.setPosition(position);
            if (!linear.isEnabled()) linear.enable();
        };
        return system;
    }
};

OperationsManager.prototype.assembleTemplate = function (name) {
    var code = "" + fun;
    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
    code = code.replace(/<name>/gm, name);
    return code.trim();

    function fun() {
        var ASSEMBLE = new Assemble();
        ASSEMBLE.content = {
            "options": {"name": "<name>"},
            "declarations":{"BOX":{"name":"BOX","path":["BOX"],"object":"BasicCube","options":{"depth":30,"height":5,"width":15,"mass":0.1,"friction":0.9,"restitution":0,"color":8948087,"opacity":0.8,"margin":0.1,"connectorSet":"mixed","connectorDistance":5,"name":"BOX"}},"WHEEL":{"name":"WHEEL","path":["WHEEL"],"object":"Wheel","options":{"length":2,"innerDiameter":3,"outerDiameter":10,"mass":0.02,"friction":0.99,"restitution":0.5,"color":2236962,"opacity":0.9,"units":"cm","radiusSegments":24,"margin":0.25,"heightSegments":1,"cut":0,"name":"WHEEL"}},"WHEEL2":{"name":"WHEEL2","path":["WHEEL2"],"object":"Wheel","options":{"length":2,"innerDiameter":3,"outerDiameter":10,"mass":0.02,"friction":0.99,"restitution":0.5,"color":2236962,"opacity":0.9,"units":"cm","radiusSegments":24,"margin":0.25,"heightSegments":1,"cut":0,"name":"WHEEL2"}}},
            "physics":{"BOX":{"position":[-10.730036735534668,3.671055793762207,15.910149574279785],"quaternion":[0.0003054811677429825,0.0037287601735442877,0.08050577342510223,0.9967471361160278]},"WHEEL":{"position":[-2.0698893070220947,5.094032287597656,5.844334125518799],"quaternion":[0.15181368589401245,-0.12432926893234253,0.7464298009872437,0.6358753442764282]},"WHEEL2":{"position":[4.94941520690918,1.0399999618530273,-5.907021522521973],"quaternion":[4.667731756669014e-10,0.0018292114837095141,5.134163649778145e-10,0.9999983310699463]}},"connections":[{"fixed":"BOX","moved":"WHEEL","fixedIndex":30,"movedIndex":0,"controllerOptions":{"type":"motor","name":"MOTOR1","rpm":0,"torque":5,"isEnabled":false,"low":-180,"high":180,"mirror":false,"reverse":false,"offset":0,"gui":true}}],
            "connectorOptions":[],
            "programs":[],
            "isCompiled":false};
        ASSEMBLE.setOptions('name', "<name>");
        return ASSEMBLE;
    }
};

OperationsManager.prototype.assembleProgramTemplate = function (name) {
    var code = "" + fun;
    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
    code = code.replace(/<name>/igm, name);
    code = code.replace('<user>', (this.servedDatabase.getUsername() || ""));
    code = code.replace('<data>', formatedTime());
    code = code.replace(/\n            /mg, '\n  ');
    code = code.replace(/\n        /mg, '\n');
    return code;

    function fun() {/*
     <name>

     <user>

     <data>
     */
    }
};
