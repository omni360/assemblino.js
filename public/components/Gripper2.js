function Gripper2(){
    /*
     Simple Gripper featuring a GUI controller and programming API:

     .close()
     <br />
     .open()
     <br />
     .distance(value)

     The fingers small protuberances at the end (nails?!) which may improve grasping
     */
    var options = _.defaults(arguments[0] || {}, {
        name: nextName('Gripper'), //name should always be somehow defined
        color: 0x71ac82,
        force: 5,
        size: 5,
        thickness: 0.5,
        depth: 2,
        mass: 0.02
    });
    var system = new System();
    system.setOptions(options);

    var thickness = options.thickness;
    var base = new Part({
        name: 'base',
        mass: 0.6*options.mass,
        material: 'plastic',
        shape: 'box',
        color: options.color,
        width: options.size+thickness,
        depth: options.depth,
        height: thickness,
        y: thickness/2
    });
    base.addConnector({
        name: 'base',
        base: [0, -thickness/2, 0],
        up: [0,-1,0],
        front: [0,0,1]
    });
    var toWing1 = base.addConnector({
        name: 'toWing1',
        base: [-options.size/2, thickness/2, 0],
        up: [1,0,0],
        front: [0,1,0],
        touchable: false
    });
    var toWing2 = base.addConnector({
        name: 'toWing2',
        base: [options.size/2, thickness/2, 0],
        up: [-1,0,0],
        front: [0,1,0],
        touchable: false
    });
    var wing1 = new Part({
        name: 'wing1',
        mass: 0.2*options.mass,
        material: 'plastic',
        shape: 'box',
        color: options.color,
        width: thickness,
        depth: options.depth,
        height: options.size,
        y: options.size/2 + thickness,
        x: -options.size/2
    });
    wing1.addBody({
        material: 'plastic',
        shape: 'box',
        color: options.color,
        width: thickness,
        depth: options.depth,
        height: thickness,
        x: thickness/2,
        y: options.size/2 - thickness/2
    });
    var toBase1 = wing1.addConnector({
        name: 'toBase',
        base: [0, -options.size/2, 0],
        up: [1,0,0],
        front: [0,1,0],
        touchable: false
    });

    var wing2 = new Part({
        name: 'wing2',
        mass: 0.2*options.mass,
        material: 'plastic',
        shape: 'box',
        color: options.color,
        width: thickness,
        depth: options.depth,
        height: options.size,
        y: options.size/2 + thickness/2,
        x: options.size/2
    });
    wing2.addBody({
        material: 'plastic',
        shape: 'box',
        color: options.color,
        width: thickness,
        depth: options.depth,
        height: thickness,
        x: -thickness/2,
        y: options.size/2 - thickness/2
    });
    var toBase2 = wing2.addConnector({
        name: 'toBase',
        base: [0, -options.size/2, 0],
        up: [-1,0,0],
        front: [0,1,0],
        touchable: false
    });
    system.add(base);
    system.add(wing1);
    system.add(wing2);
    var realMinimum = thickness/2;
    system.setDistance = function(v){
        var controls = [system.getController('w1'), system.getController('w2')];
        controls[0].setPosition(options.size/2-thickness/2-v);
        controls[1].setPosition(options.size/2-thickness/2-v);
    };
    system.open = function(){
        this.setDistance(options.size/2-thickness/2);
    };
    system.close = function(){
        this.setDistance(realMinimum);
    };
    setTimeout(function(){
        var c = system.addGUIController({distance: options.size/2-thickness/2},'distance', realMinimum, options.size/2-thickness/2);
        c.onChange(function(v){
            system.setDistance(v);
        });
    }, 1000);

    system.join({
        fixed: 'base',
        moved: 'wing1',
        fixedIndex: 'toWing1',
        movedIndex: 'toBase'
    }, {
        name: "w1",
        type: 'linear',
        isEnabled: true,
        gui: false,
        velocity: 10,
        force: options.force,
        position: 0,
        low: 0,
        high: options.size/2-thickness/2
    });

    system.join({
        fixed: 'base',
        moved: 'wing2',
        fixedIndex: 'toWing2',
        movedIndex: 'toBase'
    }, {
        name: "w2",
        type: 'linear',
        isEnabled: true,
        gui: false,
        velocity: 10,
        force: options.force,
        position: 0,
        low: 0,
        high: options.size/2-thickness/2
    });

    return system;
}