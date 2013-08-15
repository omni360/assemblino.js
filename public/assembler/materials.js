function Material (options){
    options = _.defaults(options || {}, {
        material: ''
    });
    var dbMat = MaterialTemplates[options.material];
    if (dbMat){
        _.defaults(options, dbMat);
    }
    options.type = options.type || options.material;
    if (options.opacity!==undefined && options.opacity<1){
        options.transparent = true;
    }
    var mat;
    switch (options.type){
        case 'phong':
            mat = new THREE.MeshPhongMaterial(options);
            break;
        case 'lambert':
            mat = new THREE.MeshLambertMaterial(options);
            break;
        case 'basic':
            mat = new THREE.MeshBasicMaterial(options);
            break;
        default:
            mat = new THREE.MeshPhongMaterial(options);
            break;
    }
    if (options.collide){
        options.friction || (options.friction = 0);
        options.restitution || (options.restitution = 0);
        return Physijs.createMaterial(mat, options.friction, options.restitution);
    } else {
        return mat;
    }
}

var MaterialTemplates = {
    metal: {
        type: 'phong',
        color: 0xbbbbbb,
        friction: 0.2,
        restitution: 0.2,
        specular: 0xaaaaaa
    },
    steel: {
        type: 'phong',
        color: 0xaaaaaa,
        friction: 0.2,
        restitution: 0.2,
        specular: 0x777777
    },
    iron: {
        type: 'phong',
        color: 0x666666,
        friction: 0.5,
        restitution: 0.1,
        specular: 0x444444
    },
    rubber: {
        type: 'phong',
        color: 0x444444,
        friction: 9.9,
        restitution: 0.9
    },
    carton: {
        type: 'lambert',
        color: 0xB67C3D,
        friction: 0.9,
        restitution: 0.9
    },
    plastic: {
        type: 'phong',
        color: 0xeeaaee,
        friction: 9.9,
        restitution: 0.8,
        specular: 0x555555
    }
};