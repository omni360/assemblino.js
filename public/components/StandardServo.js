function StandardServo(){
    /*
     Standard Servo
     */

    var opt = _.defaults(arguments[0] || {}, {
        name: nextName('SERVO'),
        massKg: 0.045,
        servoColor: 0x111111,
        opacity: 1,
        width: 4
    });

    var dimensions = {
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
    };
    var scale = opt.width/dimensions.M;
    if (scale!=1){
        _.map(dimensions, function(value, key){
            dimensions[key] = value * scale;
        });
    }

    return  Assembler.get('GenericServo4', _.extend(opt, dimensions));
}