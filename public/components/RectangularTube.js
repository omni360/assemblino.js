function RectangularTube() {
    /*
     Rectangular Tube

     This tube allows objects passing trough.

     Attention: The center of mass is not centered, but concentrated in one side segment.
     */
    var part = new Part();

    var options = _.defaults(arguments[0] || {}, {
        name: nextName('TUBE'), //its important to include the name
        mass: 0.01, //Kg
        color: randomColor(),
        height: 4,
        width: 8,
        depth: 6,
        thickness: 1,
        friction: 0.6,
        restitution: 0.3,
        opacity: 1
    });
    var i;
    //some validations
    var min = 0.001;
    //prefix is used to assign a prefix to connectors. allowing to assign different names to connectors if the parent part has repetitions of this part
    var prefix = options.cprefix || "";
    if (options.height < min) options.height = min;
    if (options.width < min) options.width = min;
    if (options.depth < min) options.depth = min;
    if (options.thickness > (options.width / 2 - min)) options.thickness = options.width / 2 - min;
    if (options.thickness > (options.depth / 2 - min)) options.thickness = options.depth / 2 - min;
    part.setOptions(options);

    var outer = new THREE.CubeGeometry(options.width, options.height, options.depth);
    var inner = new THREE.CubeGeometry(options.width-options.thickness*2, options.height, options.depth-options.thickness*2);
    var fv = ['a', 'b', 'c', 'd'];
    for (i = 0; i < 4; i++) {
        var face = outer.faces[[0,1,4,5][i]];
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
            height: options.height
        }));
    }
    part.mesh.position.y = options.height / 2;
    part.addConnector({
        name: prefix + 'top',
        base: [0, options.height / 2, 0]
    });
    part.addConnector({
        name: prefix + 'bottom',
        base: [0, -options.height / 2, 0]
    });
    part.addConnector({
        name: prefix + 'center',
        base: [0, 0, 0]
    });
    part.addConnector({
        name: prefix + '+d',
        base: [0, 0, options.depth/2],
        up: [0,0,1],
        front: [0,1,0]
    });
    part.addConnector({
        name: prefix + '-d',
        base: [0, 0, -options.depth/2],
        up: [0,0,-1],
        front: [0,1,0]
    });
    part.addConnector({
        name: prefix + '+w',
        base: [options.width/2, 0, 0],
        up: [1,0,0],
        front: [0,1,0]
    });
    part.addConnector({
        name: prefix + '-w',
        base: [-options.width/2, 0, 0],
        up: [-1,0,0],
        front: [0,1,0]
    });
    return part;

}
