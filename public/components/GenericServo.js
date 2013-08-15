function GenericServo() {
    /*
     Generic Servo

     Measures taken from:<br />
     http://www.servocity.com/html/hs-485hb_servo.html
     */

    var options = _.defaults(arguments[0] || {}, {
        name: nextName('SERVO'),
        color: 0x222222,
        torqueKgCm: 6,
        massKg: 0.045,
        lowAngle: -90,
        highAngle: 90,
        rpm: 50,
        shaftDiameter: 0.6,
        opacity: 1,
        A: 1.982,
        B: 1.39,
        C: 3.435,
        D: 1,
        E: 1,
        F: 3,
        G: 1.2,
        H: 2.8,
        J: 5.31,
        K: 0.975,
        L: 0.442,
        M: 4,
        X: 0.32
    });

    var shaftHeight = options.G - options.K;

    var width = options.M;
    var height = options.H + options.K;
    var depth = options.A;


    var system = new System();

    var box = new Part(_.extend(_.clone(options), {
        name: 'CASE',
        shape: 'box',
        width: width,
        height: height,
        depth: depth,
        mass: 0.8*options.massKg,
        material: 'plastic',
        y: height / 2,
        x: options.M/2 - options.E
    }));
    //the screw wings
    var wingHeight = options.K/4;
    box.addDress( {
        shape: 'box',
        color: options.color,
        width: options.J,
        height: wingHeight,
        depth: options.A,
        material: 'plastic',
        opacity: options.opacity,
        y: height/2 - options.K + wingHeight/2
    });
    box.addDress( {
        shape: 'cylinder',
        color: options.color,
        radius: 0.7 * Math.min(options.E, options.A),
        height: options.G - options.K,
        material: 'plastic',
        opacity: options.opacity,
        y: height/2 + shaftHeight/2,
        x: -options.M/2 + options.E
    });
    box.addConnector({
        name: 'top',
        front: [-1,0,0],
        base: [-options.M/2 + options.E, height / 2 + shaftHeight/2, 0],
        touchable: false
    });
    var bx = (options.B+options.C)/2;
    var by = height/2 - options.K;
    var bz =  options.D/2;
    var bases = [
        [-bx,by,bz],
        [-bx,by, 0],
        [-bx,by, -bz],
        [bx,by, bz],
        [bx,by, 0],
        [bx,by, -bz]
    ];
    var fronts = [
        [1,0,0],
        [-1,0,0],
        [1,0,0],
        [-1,0,0],
        [1,0,0],
        [-1,0,0]
    ];
    var names =   ['f+', 'f!', 'f-', 'r+','r!','r-'];
    for (var i = 0; i < names.length; i++){
        box.addConnector({
            name: names[i],
            base: bases[i],
            up: [0,-1,0],
            front: fronts[i],
            accept: ['hinge', 'fix'],
            prefer: ['hinge']
        });
    }
    system.add(box);

    var shaft = new Part({
        name: 'SHAFT',
        mass: 0.2 * options.massKg,
        material: 'metal',
        shape: 'cylinder',
        diameter: options.shaftDiameter,
        height: shaftHeight,
        opacity: options.opacity,
        y: shaftHeight/2 + height
    });

    shaft.addDress({
        material: 'metal',
        shape: 'cylinder',
        diameter: options.shaftDiameter,
        height: shaftHeight * 2,
        opacity: options.opacity
    });

    shaft.addConnector({
        name: 'center',
        base: [0, 0, 0],
        front: [-1,0,0],
        touchable: false
    });

    shaft.addConnector({
        name: 'shaft',
        front: [-1,0,0],
        base: [0, shaftHeight/2, 0],
        prefer: 'fix',
        allow: ['fix']
    });

    system.add(shaft);

    system.join({
        fixed: 'CASE',
        moved: 'SHAFT',
        fixedIndex: 'top',
        movedIndex: 'center'
    }, {
        name: "SERVO",
        type: 'servo',
        isEnabled: true,
        rpm: options.rpm,
        torque: options.torqueKgCm,
        angle: 0,
        low: options.lowAngle,
        high: options.highAngle
    });

    system.setOptions(options);

    return system;
}