function GenericServo4() {
    /*
     Generic Servo 4

     Like Generic Servo, but without additional part for the shaft, expecting to reduce the number or constraints, thus
     having better simulations with less CPU usage. The shaft connector is free to have a servo connection.


     Measures taken from:<br />
     http://www.servocity.com/html/hs-485hb_servo.html

     */

    var opt = _.defaults(arguments[0] || {}, {
        name: nextName('SERVO'),
        color: 0x222222,
        massKg: 0.045,
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

    var shaftHeight = opt.G - opt.K;
    var width = opt.M;
    var height = opt.H + opt.K;
    var depth = opt.A;

    var part = new Part(_.extend(_.clone(opt), {
        name: 'CASE',
        shape: 'box',
        width: width,
        height: height,
        depth: depth,
        mass: opt.massKg,
        material: 'plastic',
        y: height / 2,
        x: opt.M/2 - opt.E
    }));

    //the screw wings
    var wingHeight = opt.K/4;
    part.addDress( {
        shape: 'box',
        color: opt.color,
        width: opt.J,
        height: wingHeight,
        depth: opt.A,
        material: 'plastic',
        opacity: opt.opacity,
        y: height/2 - opt.K + wingHeight/2
    });

    var cylOptions =  {
        shape: 'cylinder',
        color: opt.color,
        radius: 0.7 * Math.min(opt.E, opt.A),
        height: opt.G - opt.K,
        material: 'plastic',
        opacity: opt.opacity,
        y: height/2 + shaftHeight/2,
        x: -opt.M/2 + opt.E
    };
    //the shaft
    part.addDress(_.extend(_.clone(cylOptions), {
        material: 'metal',
        color: 0xdddddd,
        radius: cylOptions.radius/3,
        height: cylOptions.height * 4
    }));
    //the prominences
    part.addDress(_.clone(cylOptions));

    part.addConnector({
        name: 'shaft',
        front: [-1,0,0],
        base: [-opt.M/2 + opt.E, height / 2 + shaftHeight, 0],
        accept: ['servo'],
        prefer: 'servo'
    });

    var bx = (opt.B+opt.C)/2;
    var by = height/2 - opt.K;
    var bz =  opt.D/2;
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
        part.addConnector({
            name: names[i],
            base: bases[i],
            up: [0,-1,0],
            front: fronts[i],
            accept: ['hinge', 'fix'],
            prefer: ['hinge']
        });
    }
    part.setOptions(opt);

    return part;
}