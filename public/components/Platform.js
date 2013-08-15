function Platform(){
    /**
     * A cubic building block with evenly spaced connectors.
     *
     * connectorSet: defines the orientation of connectors
     * connectorDistance: the distance between connectors
     * margin: the margin/distance between connectors and the face
     */

    var opt = _.defaults(arguments[0] || {}, {
        name: nextName('PLATE'),
        depth: 18,
        height: 1,
        width: 10,
        mass: 0.1,
        friction: 0.9,
        restitution: 0.0,
        color: 0x666677,
        opacity: 1.0,
        margin: 0.01,
        connectorSet: ['female','mixed','male', 'none'],
        connectorDistance: 4
    });

    var part = new Part(_.extend(_.clone(opt), {
        shape: 'box',
        material: 'metal',
        y: opt.height/2
    }));

    part.setOptions(opt);

    var connSet = opt.connectorSet;
    if (connSet instanceof Array){
        connSet = connSet[0];
    }
    var antiConn;
    if (connSet==='male'){
        connSet = 1;
        antiConn = -1;
    } else if (connSet==='female'){
        connSet = -1;
        antiConn = 1;
    } else if (connSet==='none'){
        return part;
    } else {
        connSet = -1;
        antiConn = -1;
    }

    var distance = opt.connectorDistance;
    var axis = {x: 'width', y: 'height', z: 'depth'};
    ['x','y','z'].map(function(dim){
        var positions = [];
        var quant = Math.floor(opt[axis[dim]]/distance)+1;
        if (quant % 2 == 0) quant--;
        var rest = opt[axis[dim]] - quant*distance;
        if (quant>0) for (var i = 0; i < quant; i++){
            positions.push((i - quant/2)*distance + distance/2);
        }
        axis[dim + "_positions"] = positions;
    });

    var combinations = [
        {
            //top surface
            x: axis["x_positions"],
            y: [opt.height/2 + opt.margin],
            z: axis["z_positions"],
            up: [0,connSet,0]
        },
        {
            //bottom surface
            x: axis["x_positions"],
            y: [-opt.height/2 - opt.margin],
            z: axis["z_positions"],
            up: [0,antiConn,0]
        },
        {
            //front surface
            x: [opt.width/2 + opt.margin],
            y: axis["y_positions"],
            z: axis["z_positions"],
            up: [connSet,0,0],
            front: [0,0,1]
        },
        {
            //back surface
            x: [-opt.width/2 - opt.margin],
            y: axis["y_positions"],
            z: axis["z_positions"],
            up: [antiConn,0,0],
            front: [0,0,1]
        },
        {
            //left surface
            x: axis["x_positions"],
            y: axis["y_positions"],
            z: [opt.depth/2 + opt.margin],
            up: [0,0,connSet]
        },
        {
            //right surface
            x: axis["x_positions"],
            y: axis["y_positions"],
            z: [-opt.depth/2 - opt.margin],
            up: [0,0,antiConn]
        }
    ];

    function connName(){
        //Arguments are a strange array, they do not have the method join
        return (opt.cprefix||"") + [].join.call(arguments, "-");
    }
    _.map(combinations, function(comb, index){
        for (var i = 0; i < comb.x.length; i++){
            for (var j = 0; j < comb.y.length; j++){
                for (var k = 0; k < comb.z.length; k++){
                    part.addConnector({
                        name: connName(index,i,j,k),
                        base: [comb.x[i], comb.y[j], comb.z[k]],
                        up: comb.up,
                        front: comb.front || [1,0,0],
                        prefer: 'fix'
                    });
                }
            }
        }
    });

    return part;
}