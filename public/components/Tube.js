function Tube() {
    /*
     Circular Tube

     This tube allows objects passing trough.

     Attention: The center of mass is not centered, but concentrated in one side segment.
     */
    var part = new Part();

    var options = _.defaults(arguments[0] || {}, {
        name: nextName('Tube'), //its important to include the name
        mass: 0.01, //Kg
        color: randomColor(),
        length: 4,
        diameter: 8,
        thickness: 1,
        segments: 12,
        friction: 0.6,
        restitution: 0.3,
        opacity: 1
    });
    var i;
    //some validations
    var min = 0.001;
    //prefix is used to assign a prefix to connectors. allowing to assign different names to connectors if the parent part has repetitions of this part
    var prefix = options.cprefix || "";
    if (options.length < min) options.length = min;
    if (options.diameter < min) options.diameter = min;
    if (options.thickness > (options.diameter / 2 - min)) options.thickness = options.diameter / 2 - min;
    options.segments = Math.max(Math.round(options.segments), 3);
    part.setOptions(options);

    var outer = new THREE.CylinderGeometry(options.diameter / 2, options.diameter / 2, options.length, options.segments, 1);
    var inner = new THREE.CylinderGeometry(options.diameter / 2 - options.thickness, options.diameter / 2 - options.thickness, options.length, options.segments, 1);
    var fv = ['a', 'b', 'c', 'd'];
    for (i = 0; i < outer.faces.length; i++) {
        var face = outer.faces[i];
        var vertices = [];
        if (!(face instanceof THREE.Face4)) continue;
        _.map(fv, function (abcd) {
            vertices.push(outer.vertices[face[abcd]]);
            vertices.push(inner.vertices[face[abcd]]);
        });
        part.addBody(_.clonex(options, {
            shape: 'convex',
            material: 'lambert',
            vertices: vertices,
            height: options.length
        }));
    }

    part.mesh.position.y = options.length / 2;
    part.addConnector({
        name: prefix + 'top',
        base: [0, options.length / 2, 0]
    });
    part.addConnector({
        name: prefix + 'bottom',
        base: [0, -options.length / 2, 0]
    });
    part.addConnector({
        name: prefix + 'center',
        base: [0, 0, 0]
    });
    for (i = 0; i < 4; i++) {
        part.addConnector({
            name: prefix + 'r'+i*360/4,
            base: [(options.diameter/2) * Math.sin(2 * i * Math.PI / 4),0,(options.diameter/2) * Math.cos(2 * i * Math.PI / 4)],
            up: [Math.sin(2 * i * Math.PI / 4),0,Math.cos(2 * i * Math.PI / 4)],
            front: [0,1,0]
        });
    }
    return part;

}
