function ChildrenTests() {
    /*
     This is a system composed by 3 parts Green, Red, Blue.

     All parts are created with some original translation and rotation.

     Blue is added as child of Green and then Green is added as child of Red.

     The result looks good: see TestsChildren assemble to verify that the children also collide respecting their geometries.

     Unfortunately the center of mass of th whole resulting part is the center of mass of the first parent part.
     */

    var options = _.defaults(arguments[0] || {}, {
        name: nextName('ChildrenTests'),
        color: 0x773333,
        size: 5,
        mass: 0.1,
        friction: 10
    });
    var system = new System();
    system.setOptions(options);
    var parts = [];
    for (var i = 0; i < 3; i++) {
        var part = new Part(_.extend(_.clone(options), {
            name: 'P' + i,
            shape: 'box',
            color: [0x772222, 0x227722, 0x222277][i],
            x: (i && 1 || 0) * options.size,
            y: (i == 0 ? 1: 0) * options.size,
            ry: Math.PI/(i + 1.5),
            rz: Math.PI/(i + 1.2),
            rx: Math.PI/(i + 1.7)
        }));
        part.addConnector({
            name: 'C' + i,
            base: [0, options.size / 2, 0]
        });
        parts.push(part);
    }
    parts[1].add(parts[2]);
    parts[0].add(parts[1]);
    system.add(parts[0]);

    return system;
}
