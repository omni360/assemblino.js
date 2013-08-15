function Cylinder2(){
    /*
     A cylinder with connectors distributed around it
     */
    var part = new Part();

    var options = _.defaults(arguments[0] || {}, {
        name: nextName('Cylinder2'), //its important to include the name
        mass: 0.05,
        color: randomColor(),
        height: 1,
        diameter: 5,
        radialConnectors: 6,
        margin: 0.5,
        connectorAxis: ['radial','tangent','axial']
    });
    options.radialConnectors = Math.round(Math.max(options.radialConnectors || 0, 1));
    part.setOptions(options);
    part.addBody(_.extend(_.clone(options), {
        shape: 'cylinder',
        material: 'plastic',
        y: options.height/2,
        segments: options.radialConnectors *3
    }));
    var axis = options.connectorAxis || 'radial' ;
    if (typeof axis == 'object'){
        axis = axis[0];
    }
    var radialDistance = options.diameter/2 + options.margin;
    //for each connector compute the orientation and place it
    for (var i = 0; i < options.radialConnectors; i++){
        var angle = i * 2 * Math.PI / options.radialConnectors;
        var deg = Math.round(angle * 180 / Math.PI);
        var x = Math.cos(angle+Math.PI/2);
        var z = Math.sin(angle+Math.PI/2);
        var up = [x, 0, z];
        var front = [0, 1, 0];
        if (axis =='tangent'){
            up = [Math.cos(angle), 0, Math.sin(angle)];
        } else if (axis=='axial'){
            front = up;
            up = [0,1,0];
        }
        part.addConnector({
            name: 'angle' + deg,
            base: [x * radialDistance, 0, z * radialDistance],
            up: up,
            front: front,
            prefer: 'point',
            accept: ['fix', 'point', 'motor', 'servo', 'hinge','slider']
        });
    }
    part.addConnector({
        name: 'top',
        base: [0,options.height/2 + options.margin, 0],
        prefer: 'fix',
        accept: ['fix', 'point', 'motor', 'servo']
    });
    part.addConnector({
        name: 'bottom',
        base: [0,-options.height/2 - options.margin, 0],
        prefer: 'fix',
        accept: ['fix', 'point', 'motor', 'servo']
    });
    return part;

}