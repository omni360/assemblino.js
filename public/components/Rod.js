
function Rod() {
    /*
     Rod
     */
    var part = new Part();
    var options = _.defaults(arguments[0] || {}, {
        name: nextName('ROD'), //its important to include the name
        mass: 0.02,
        color: randomColor(),
        height: 10,
        diameter: 1,
        margin: 0.5,
        connectorAxis: ['axial','perpendicular']
    });
    part.setOptions(options);
    var axis = options.connectorAxis || 'axial';
    if (typeof axis == 'object'){
        axis = axis[0];
    }
    var up = {
        axial: [0,1,0],
        perpendicular: [0,0,1]
    }[axis];
    part.addBody(_.extend(_.clone(options), {
        shape: 'cylinder',
        material: 'plastic',
        y: options.height/2
    }));
    part.addConnector({
        name: 'top',
        up: up,
        base: [0,options.height/2 + options.margin, 0],
        prefer: 'fix',
        accept: ['fix', 'point', 'motor', 'servo','hinge']
    });
    part.addConnector({
        name: 'bottom',
        up: up,
        base: [0,-options.height/2 - options.margin, 0],
        prefer: 'fix',
        accept: ['fix', 'point', 'motor', 'servo','hinge']
    });
    part.addConnector({
        name: 'middle',
        up: up,
        base: [0,0,0],
        prefer: 'slider',
        accept: ['fix', 'point', 'motor', 'servo','hinge','slider']
    });
    return part;
}