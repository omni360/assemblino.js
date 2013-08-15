function GenericServo2() {
    /*
     Generic Servo 2

     Measures taken from:<br />
     http://www.servocity.com/html/hs-485hb_servo.html
     <br/>
     layout base on <br />
     http://hitecrcd.com/products/servos/discontinued-servos-servo-accessories/hsr-5498sg-hmi-premium-robot-servo/product
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
    //to be shorter
    var $ = options;

    var shaftHeight = $.G - $.K;

    var width = $.M;
    var height = $.H + $.K;
    var depth = $.A;


    var system = new System();

    var box = new Part(_.extend(_.clone(options), {
        name: 'CASE',
        shape: 'box',
        width: width,
        height: height,
        depth: depth,
        mass: 0.5*options.massKg,
        material: 'plastic',
        y: height / 2,
        x: $.M/2 - $.E
    }));
    var cylOptions =  {
        shape: 'cylinder',
        color: options.color,
        radius: 0.7 * Math.min($.E, $.A),
        height: $.G - $.K,
        material: 'plastic',
        opacity: options.opacity,
        y: height/2 + shaftHeight/2,
        x: -$.M/2 + $.E
    };
    box.addDress(_.clone(cylOptions));
    box.addDress(_.extend(_.clone(cylOptions), {
        x: -cylOptions.x
    }));
    box.addDress(_.extend(_.clone(cylOptions), {
        y: -cylOptions.y,
        x: cylOptions.x
    }));
    box.addDress(_.extend(_.clone(cylOptions), {
        y: -cylOptions.y,
        x: -cylOptions.x
    }));
    box.addConnector({
        name: 'shaft',
        front: [-1,0,0],
        base: [-$.M/2 + $.E, height / 2 + shaftHeight/2, 0],
        touchable: false
    });
    box.addConnector({
        name: 'shaft-bottom',
        front: [-1,0,0],
        base: [-$.M/2 + $.E, -height / 2 - shaftHeight, 0],
        accept: ['hinge','fix'],
        prefer: 'hinge'
    });
    box.addConnector({
        name: 'aux-bottom',
        front: [1,0,0],
        base: [$.M/2 - $.E, -height / 2 - shaftHeight, 0],
        accept: ['hinge','fix'],
        prefer: 'fix'
    });
    box.addConnector({
        name: 'aux-top',
        up: [0,-1,0],
        front: [1,0,0],
        base: [$.M/2 - $.E, height / 2 + shaftHeight, 0],
        accept: ['hinge','fix'],
        prefer: 'fix'
    });
    system.add(box);

    var shaft = new Part({
        name: 'SHAFT',
        mass: 0.5 * options.massKg,
        material: 'metal',
        shape: 'cylinder',
        diameter: options.shaftDiameter,
        height: shaftHeight * 0.9,
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
        name: 'shaft-top',
        front: [-1,0,0],
        base: [0, shaftHeight/2, 0],
        prefer: 'fix',
        allow: ['fix']
    });

    system.add(shaft);

    system.join({
        fixed: 'CASE',
        moved: 'SHAFT',
        fixedIndex: 'shaft',
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
    box.avoidCollisionWith(shaft);
    system.setOptions(options);

    return system;
}