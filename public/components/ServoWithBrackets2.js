function ServoWithBrackets2() {
    /*
     Generic Servo 4 with brackets
     */
    //TODO the mass attribution is not correct
    var opt = _.defaults(arguments[0] || {}, {
        name: nextName('SERVO'),
        massKg: 0.045,
        torqueKgCm: 6,
        lowAngle: -90,
        highAngle: 90,
        initialAngle: -30,
        rpm: 50,
        servoColor: 0x111111,
        brackets: ['shaft + case', 'shaft', 'case', 'none'],
        bracketsColor: 0x333366,
        opacity: 1,
        width: 4
    });

    var bracketsSet = opt.brackets instanceof Array ? opt.brackets[0] : opt.brackets;
    //http://www.servocity.com/html/hs-485hb_servo.html
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
    var system = new System();

    var scale = opt.width / dimensions.M;
    if (scale != 1) {
        _.map(dimensions, function (value, key) {
            dimensions[key] = value * scale;
        });
    }
    system.setOptions(_.clone(opt));

    var servoCase = Assembler.get('GenericServo4', _.extend(_.extend(_.clone(opt), dimensions), {
        name: 'CASE',
        massKg: 0.9 * opt.massKg,
        color: opt.servoColor
    }));
    var sOpt = servoCase.getOptions();

    var pos = servoCase.mesh.position;
    servoCase.setPhysics({
        position: [pos.x,sOpt.A/2, pos.z],
        rotation: [Math.PI/2,0,0]
    });
    var bracket = Assembler.get('Brackets_U', _.extend(_.clone(opt), {
        width: sOpt.H + sOpt.K + 4 * (sOpt.G - sOpt.K),
        thickness: (sOpt.G - sOpt.K),
        height: 2 * sOpt.A,
        depth: sOpt.A,
        name: 'BRK1',
        mass: 0.1 * opt.massKg,
        color: opt.bracketsColor
    }));
    var bOpt = bracket.getOptions();
    bracket.setPhysics({
        rotation: [-Math.PI / 2, -0, -Math.PI / 2],
        position: [-bOpt.height + bOpt.depth / 2, bOpt.depth / 2, 0]
    });

    if (bracketsSet.match(/case/i)) {
        //fixed bracket
        var bracket2 = Assembler.get('Platform', _.extend(_.clone(bOpt), {
            width: sOpt.J + bOpt.thickness*2,
            height: sOpt.H + sOpt.K + bOpt.thickness * 1.9,
            depth: sOpt.A + bOpt.thickness * 1.9,
            name: 'BRK2',
            connectorDistance: (sOpt.J + bOpt.thickness*2)/3
        }));
        bracket2.setPhysics({
            position: [0,0,0]
        });
        servoCase.removeConnectorsExcept('shaft');
        bracket2.removeConnectorsExcept([
            '5-0-1-0','5-1-1-0','5-2-1-0','4-0-1-0','4-1-1-0','4-2-1-0','2-0-1-0','0-2-0-0','1-2-0-0'
        ]);
        //remove connectors
        servoCase.add(bracket2);
    }
    system.add(servoCase);
    if (bracketsSet.match(/shaft/i)) {
        system.add(bracket);

        system.join({
            fixed: 'CASE',
            moved: 'BRK1',
            fixedIndex: 'shaft',
            movedIndex: 'right'
        }, {
            name: "SERVO",
            type: 'servo',
            isEnabled: true,
            rpm: opt.rpm,
            torque: opt.torqueKgCm,
            angle: opt.initialAngle,
            low: opt.lowAngle,
            high: opt.highAngle,
            angleOffset: -180
        });
    }
    return system;
}