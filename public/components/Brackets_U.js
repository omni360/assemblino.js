function Brackets_U() {
    /*
     C or U shape Bracket
     */

    var options = _.defaults(arguments[0] || {}, {
        name: nextName('BRACK'), //its important to include the name
        mass: 0.05, //Kg
        color: 0x666666,
        width: 2.8 + 0.975 + 2 * (1.2 - 0.975) + 2 * 0.2, //H + K + 2*(G-K) + 2 * thickness
        depth: 2,
        height: 4,
        thickness: 0.2,
        friction: 0.3
    });
    var part = new Part(_.extend(_.clone(options), {
        shape: 'cube',
        height: options.thickness,
        y: options.thickness/2
    }));

    part.setOptions(_.clone(options));

    part.addBody(_.extend(_.clone(options), {
        shape: 'cube',
        height: options.height - options.depth/2,
        width: options.thickness,
        y: (options.height - options.depth/2)/2,
        x: -options.width/2+options.thickness/2
    }));

    part.addBody(_.extend(_.clone(options), {
        shape: 'cube',
        height: options.height - options.depth/2,
        width: options.thickness,
        y: (options.height - options.depth/2)/2,
        x: options.width/2-options.thickness/2
    }));

    part.addDress(_.extend(_.clone(options), {
        shape: 'cylinder',
        diameter: options.depth,
        height: options.thickness,
        y: options.height - options.depth/2,
        x: -options.width/2+options.thickness/2,
        rz: Math.PI/2
    }));

    part.addDress(_.extend(_.clone(options), {
        shape: 'cylinder',
        diameter: options.depth,
        height: options.thickness,
        y: options.height - options.depth/2,
        x: options.width/2-options.thickness/2,
        rz: Math.PI/2
    }));

    part.addConnector({
        name: 'left',
        base: [-options.width/2+options.thickness, options.height - options.depth/2, 0],
        up: [1,0,0],
        front: [0,-1,0],
        accept: ['fix','hinge','servo'],
        prefer: 'fix'
    });
    part.addConnector({
        name: 'right',
        base: [options.width/2-options.thickness, options.height - options.depth/2, 0],
        up: [1,0,0],
        front: [0,-1,0],
        accept: ['fix','hinge','servo'],
        prefer: 'servo'
    });
    part.addConnector({
        name: 'top',
        base: [0, -options.thickness/2, 0],
        up: [0,-1,0],
        front: [0,0,1],
        prefer: 'fix'
    });
    return part;

}