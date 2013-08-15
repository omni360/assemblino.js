function TestsPeriodicController() {
    /*
     TestsPeriodicController

     nuno

     2013-07-31 12:56
     */
    var options = _.defaults(arguments[0] || {}, {
        name: nextName('TestsPeriodicController'), //name should always be somehow defined
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
    var periodic = periodicController('SERVO',0.1,0);
    var periodic2 = periodicController('LINEAR',1,2);
    program.step = function(){
        periodic.call(this);
        periodic2.call(this);
    };
    return system;

}