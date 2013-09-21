var console = console || {};

!(function () {
    'use strict';
    //no worker?
    self.importScripts = self.importScripts || function () {
    };
    var
        transferableMessage = self.webkitPostMessage || self.postMessage,

// enum
        MESSAGE_TYPES = {
            WORLDREPORT: 0,
            COLLISIONREPORT: 1,
            VEHICLEREPORT: 2,
            CONSTRAINTREPORT: 3
        },

// temp variables
        _object,
        _vector,

// functions
        public_functions = {},
        getShapeFromCache,
        setShapeCache,
        createShape,
        reportWorld,
        reportVehicles,
        reportCollisions,
        reportConstraints,

// world variables
        fixedTimeStep, // used when calling stepSimulation
        rateLimit, // sets whether or not to sync the simulation rate with fixedTimeStep
        last_simulation_time,
        last_simulation_duration = 0,
        world,
        pause = false,

// private cache
        _vectors = [],
        _quaternions = [],
        _objects = {},
        _vehicles = {},
        _constraints = {},
        _materials = {},
        _objects_ammo = {},
        _num_objects = 0,
        _num_wheels = 0,
        _num_constraints = 0,
        _object_shapes = {},
// object reporting
        REPORT_CHUNKSIZE, // report array is increased in increments of this chunk size

        WORLDREPORT_ITEMSIZE = 14, // how many float values each reported item needs
        worldreport,

        COLLISIONREPORT_ITEMSIZE = 2, // one float for each object id
        collisionreport,

        VEHICLEREPORT_ITEMSIZE = 9, // vehicle id, wheel index, 3 for position, 4 for rotation
        vehiclereport,

        CONSTRAINTREPORT_ITEMSIZE = 6, // constraint id, offset object, offset, applied impulse
        constraintreport;

    var ab = new ArrayBuffer(1);

    transferableMessage(ab, [ab]);
    var SUPPORT_TRANSFERABLE = ( ab.byteLength === 0 );

    console.log = console.log || function (data) {
        if (data instanceof Ammo.btVector3) {
            data = {
                x: data.getX(),
                y: data.getY(),
                z: data.getZ()
            };
        } else if (data instanceof Ammo.btQuaternion) {
            data = {
                x: data.getAxis().getX(),
                y: data.getAxis().getY(),
                z: data.getAxis().getZ(),
                w: data.getW()
            };
        }
        transferableMessage({ cmd: 'log', params: data});
    };

    getShapeFromCache = function (cache_key) {
        //if (true) return null; //no cache
        if (_object_shapes[ cache_key ] !== undefined) {
            return _object_shapes[ cache_key ];
        }
        return null;
    };

    setShapeCache = function (cache_key, shape) {
        _object_shapes[ cache_key ] = shape;
    };
    createShape = function (description) {
        var cache_key, shape;
        switch (description.type) {
            case 'plane':
                cache_key = 'plane_' + description.normal.x + '_' + description.normal.y + '_' + description.normal.z;
                if (( shape = getShapeFromCache(cache_key) ) === null) {
                    shape = new Ammo.btStaticPlaneShape(castVector(description.normal, _vectors[0]), 0);
                    setShapeCache(cache_key, shape);
                }
                break;

            case 'box':
                cache_key = 'box_' + description.width + '_' + description.height + '_' + description.depth;
                if (( shape = getShapeFromCache(cache_key) ) === null) {
                    shape = new Ammo.btBoxShape(new Ammo.btVector3(description.width / 2, description.height / 2, description.depth / 2));
                    setShapeCache(cache_key, shape);
                }
                break;
            case 'sphere':
                cache_key = 'sphere_' + description.radius;
                if (( shape = getShapeFromCache(cache_key) ) === null) {
                    shape = new Ammo.btSphereShape(description.radius);
                    setShapeCache(cache_key, shape);
                }
                break;

            case 'cylinder':
                cache_key = 'cylinder_' + description.width + '_' + description.height + '_' + description.depth;
                if (( shape = getShapeFromCache(cache_key) ) === null) {
                    shape = new Ammo.btCylinderShape(new Ammo.btVector3(description.width / 2, description.height / 2, description.depth / 2));
                    setShapeCache(cache_key, shape);
                }
                break;

            case 'capsule':
                cache_key = 'capsule_' + description.radius + '_' + description.height;
                if (( shape = getShapeFromCache(cache_key) ) === null) {
                    // In Bullet, capsule height excludes the end spheres
                    shape = new Ammo.btCapsuleShape(description.radius, description.height - 2 * description.radius);
                    setShapeCache(cache_key, shape);
                }
                break;

            case 'cone':
                cache_key = 'cone_' + description.radius + '_' + description.height;
                if (( shape = getShapeFromCache(cache_key) ) === null) {
                    shape = new Ammo.btConeShape(description.radius, description.height);
                    setShapeCache(cache_key, shape);
                }
                break;

            case 'concave':
                var triangle, triangle_mesh = new Ammo.btTriangleMesh;
                if (!description.triangles.length) return false

                for (var i = 0; i < description.triangles.length; i++) {
                    triangle = description.triangles[i];
                    triangle_mesh.addTriangle(
                        castVector(triangle[0], _vectors[0]),
                        castVector(triangle[1], _vectors[1]),
                        castVector(triangle[2], _vectors[2]),
                        true
                    );
                }

                shape = new Ammo.btBvhTriangleMeshShape(
                    triangle_mesh,
                    true,
                    true
                );
                break;
            case 'convex':
                shape = new Ammo.btConvexHullShape;
                for (var i = 0; i < description.points.length; i++) {
                    shape.addPoint(castVector(description.points[i], _vectors[0]));
                }
                break;

            case 'heightfield':

                var ptr = Ammo.allocate(4 * description.points.length, "float", Ammo.ALLOC_NORMAL);

                for (var f = 0; f < description.points.length; f++) {
                    Ammo.setValue(ptr + 4 * f, description.points[f], 'float');
                }
                shape = new Ammo.btHeightfieldTerrainShape(
                    description.xpts,
                    description.ypts,
                    ptr,
                    1,
                    -description.absMaxHeight,
                    description.absMaxHeight,
                    2,
                    0,
                    false
                );
                var vec = new Ammo.btVector3(
                    description.xsize / (description.xpts - 1),
                    description.ysize / (description.ypts - 1),
                    1);
                shape.setLocalScaling(vec);
                break;

            default:
                // Not recognized
                console.log("not recognized shape:");
                console.log(description);
                return;
                break;
        }

        return shape;
    };

    function castVector(origin, target) {
        if (!target) {
            target = new Ammo.btVector3(origin.x, origin.y, origin.z);
        }
        if (!origin) {
        } else if (origin instanceof Array) {
            target.setX(origin[0]);
            target.setY(origin[1]);
            target.setZ(origin[2]);
        } else {
            target.setX(origin.x);
            target.setY(origin.y);
            target.setZ(origin.z);
        }
        return target;
    }

    function castQuaternion(origin, target) {
        if (!target) {
            target = new Ammo.btQuaternion(origin.x, origin.y, origin.z, origin.w);
        }
        if (!origin) {
        } else if (origin instanceof Array) {
            target.setX(origin[0]);
            target.setY(origin[1]);
            target.setZ(origin[2]);
            target.setW(origin[3]);
        } else {
            target.setX(origin.x);
            target.setY(origin.y);
            target.setZ(origin.z);
            target.setW(origin.w);
        }
        return target;
    }

    function castObject(obj) {
        if (typeof obj == 'string') {
            return obj;
        } else if (obj instanceof Array) {
            return obj.map(castObject);
        } else if (obj.w !== undefined && obj.x !== undefined && obj.y !== undefined && obj.z !== undefined) {
            return new Ammo.btQuaternion(obj.x, obj.y, obj.z, obj.w);
        } else if (obj.x !== undefined && obj.y !== undefined && obj.z !== undefined) {
            return new Ammo.btVector3(obj.x, obj.y, obj.z);
        } else {
            return obj;
        }
    }

    public_functions.init = function (params) {
        self.importScripts(params.ammo);
        for (var i = 0; i < 6; i++) {
            _vectors.push(new Ammo.btVector3(0, 0, 0));
            _quaternions.push(new Ammo.btQuaternion(0, 0, 0, 1));
        }
        REPORT_CHUNKSIZE = params.reportsize || 50;
        if (SUPPORT_TRANSFERABLE) {
            // Transferable messages are supported, take advantage of them with TypedArrays
            worldreport = new Float32Array(2 + REPORT_CHUNKSIZE * WORLDREPORT_ITEMSIZE); // message id + # of objects to report + chunk size * # of values per object
            collisionreport = new Float32Array(2 + REPORT_CHUNKSIZE * COLLISIONREPORT_ITEMSIZE); // message id + # of collisions to report + chunk size * # of values per object
            vehiclereport = new Float32Array(2 + REPORT_CHUNKSIZE * VEHICLEREPORT_ITEMSIZE); // message id + # of vehicles to report + chunk size * # of values per object
            constraintreport = new Float32Array(2 + REPORT_CHUNKSIZE * CONSTRAINTREPORT_ITEMSIZE); // message id + # of constraints to report + chunk size * # of values per object
        } else {
            // Transferable messages are not supported, send data as normal arrays
            worldreport = [];
            collisionreport = [];
            vehiclereport = [];
            constraintreport = [];
        }
        worldreport[0] = MESSAGE_TYPES.WORLDREPORT;
        collisionreport[0] = MESSAGE_TYPES.COLLISIONREPORT;
        vehiclereport[0] = MESSAGE_TYPES.VEHICLEREPORT;
        constraintreport[0] = MESSAGE_TYPES.CONSTRAINTREPORT;

        var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration,
            dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
            solver = new Ammo.btSequentialImpulseConstraintSolver,
            broadphase;

        if (!params.broadphase) params.broadphase = { type: 'dynamic' };
        switch (params.broadphase.type) {
            case 'sweepprune':
                broadphase = new Ammo.btAxisSweep3(
                    castVector(params.broadphase.aabbmin),
                    castVector(params.broadphase.aabbmax)
                );
                break;

            case 'dynamic':
            default:
                broadphase = new Ammo.btDbvtBroadphase;
                break;
        }

        world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);

        fixedTimeStep = params.fixedTimeStep;
        rateLimit = params.rateLimit;

        transferableMessage({ cmd: 'worldReady' });
    };

    public_functions.registerMaterial = function (description) {
        _materials[ description.id ] = description;
    };

    public_functions.unRegisterMaterial = function (description) {
        delete _materials[ description.id ];
    };

    public_functions.setFixedTimeStep = function (description) {
        fixedTimeStep = description;
    };

    public_functions.setGravity = function (description) {
        world.setGravity(castVector(description));
    };

    public_functions.addObject = function (description) {
        var motionState, rbInfo, body;
        var shape = createShape(description);
        if (!shape) return
        // If there are children then this is a compound shape
        if (description.children) {
            var compound_shape = new Ammo.btCompoundShape, _child;
            var transParent = new Ammo.btTransform;
            transParent.setIdentity();
            compound_shape.addChildShape(transParent, shape);

            for (var i = 0; i < description.children.length; i++) {
                _child = description.children[i];

                var transChild = new Ammo.btTransform;
                transChild.setIdentity();
                transChild.setOrigin(castVector(_child.position_offset, _vectors[0]));
                transChild.setRotation(castQuaternion(_child.rotation, _quaternions[0]));

                var childShape = createShape(_child);
                compound_shape.addChildShape(transChild, childShape);
                Ammo.destroy(transChild);
            }

            shape = compound_shape;
        }

        var localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(description.mass, localInertia);

        var worldTransform = new Ammo.btTransform;
        worldTransform.setIdentity();
        worldTransform.setOrigin(castVector(description.position, _vectors[1]));
        worldTransform.setRotation(castQuaternion(description.rotation, _quaternions[1]));

        var centerOfMassOffset;
        if (description.centerOfMassOffset){
            centerOfMassOffset = new Ammo.btTransform;
            centerOfMassOffset.setOrigin(castVector(description.centerOfMassOffset, _vectors[2]));
        }
        motionState = new Ammo.btDefaultMotionState(worldTransform, centerOfMassOffset); // #TODO: btDefaultMotionState supports center of mass offset as second argument - implement
        rbInfo = new Ammo.btRigidBodyConstructionInfo(description.mass, motionState, shape, localInertia);

        if (description.materialId !== undefined && _materials[ description.materialId ]) {
            rbInfo.set_m_friction(_materials[ description.materialId ].friction);
            rbInfo.set_m_restitution(_materials[ description.materialId ].restitution);
        } else {
            console.log("no material for:");
            console.log(description);
        }

        body = new Ammo.btRigidBody(rbInfo);

        if (typeof description.collision_flags !== 'undefined') {
            body.setCollisionFlags(description.collision_flags);
            world.addRigidBody(body); //collide according to collision flags
        } else if (description.collision_masks && description.collision_masks.length == 2) {
            world.addRigidBody(body, description.collision_masks[0], description.collision_masks[1]);
        } else {
            world.addRigidBody(body, 15, 15); //collide with all
        }


        body.id = description.id;
        body._description = description;
        _objects[ body.id ] = body;

        var ptr = body.a != undefined ? body.a : body.ptr;
        _objects_ammo[ptr] = body.id;
        _num_objects++;

        transferableMessage({ cmd: 'objectReady', params: body.id });
    };

    public_functions.addVehicle = function (description) {
        var vehicle_tuning = new Ammo.btVehicleTuning(),
            vehicle;

        vehicle_tuning.set_m_suspensionStiffness(description.suspension_stiffness);
        vehicle_tuning.set_m_suspensionCompression(description.suspension_compression);
        vehicle_tuning.set_m_suspensionDamping(description.suspension_damping);
        vehicle_tuning.set_m_maxSuspensionTravelCm(description.max_suspension_travel);
        vehicle_tuning.set_m_maxSuspensionForce(description.max_suspension_force);

        vehicle = new Ammo.btRaycastVehicle(vehicle_tuning, _objects[ description.rigidBody ], new Ammo.btDefaultVehicleRaycaster(world));
        vehicle.tuning = vehicle_tuning;

        _objects[ description.rigidBody ].setActivationState(4);
        vehicle.setCoordinateSystem(0, 1, 2);

        world.addVehicle(vehicle);
        _vehicles[ description.id ] = vehicle;
    };
    public_functions.removeVehicle = function (description) {
        Ammo._destroy(_vehicles[ description.id ]);
        delete _vehicles[ description.id ];
    };

    public_functions.addWheel = function (description) {
        if (_vehicles[description.id] !== undefined) {
            var tuning = _vehicles[description.id].tuning;
            if (description.tuning !== undefined) {
                tuning = new Ammo.btVehicleTuning();
                tuning.set_m_suspensionStiffness(description.tuning.suspension_stiffness);
                tuning.set_m_suspensionCompression(description.tuning.suspension_compression);
                tuning.set_m_suspensionDamping(description.tuning.suspension_damping);
                tuning.set_m_maxSuspensionTravelCm(description.tuning.max_suspension_travel);
                tuning.set_m_maxSuspensionForce(description.tuning.max_suspension_force);
            }
            _vehicles[description.id].addWheel(
                castVector(description.connection_point, _vectors[0]),
                castVector(description.wheel_direction, _vectors[1]),
                castVector(description.wheel_axle, _vectors[2]),
                description.suspension_rest_length,
                description.wheel_radius,
                tuning,
                description.is_front_wheel
            );
        }

        _num_wheels++;

        if (SUPPORT_TRANSFERABLE) {
            vehiclereport = new Float32Array(1 + _num_wheels * VEHICLEREPORT_ITEMSIZE); // message id & ( # of objects to report * # of values per object )
            vehiclereport[0] = MESSAGE_TYPES.VEHICLEREPORT;
        } else {
            vehiclereport = [ MESSAGE_TYPES.VEHICLEREPORT ];
        }
    };

    public_functions.setSteering = function (details) {
        if (_vehicles[details.id] !== undefined) {
            _vehicles[details.id].setSteeringValue(details.steering, details.wheel);
        }
    };
    public_functions.setBrake = function (details) {
        if (_vehicles[details.id] !== undefined) {
            _vehicles[details.id].setBrake(details.brake, details.wheel);
        }
    };
    public_functions.applyEngineForce = function (details) {
        if (_vehicles[details.id] !== undefined) {
            _vehicles[details.id].applyEngineForce(details.force, details.wheel);
        }
    };

    public_functions.removeObject = function (details) {
        //console.log("removing:"); console.log(details); z
        var body = _objects[details.id];
        if (!body) return;
        var materialId = body._description.materialId;
        if (materialId) {
            delete _materials[materialId];
        }
        world.removeRigidBody(body);
        //world.removeCollisionObject(body);
        Ammo.destroy(body);
        delete _objects[details.id];
        _num_objects--;
    };

    public_functions.updateTransform = function (details) {
        _object = _objects[details.id];
        var transform = new Ammo.btTransform;
        _object.getMotionState().getWorldTransform(transform);
        if (details.pos) {
            transform.setOrigin(castVector(details.pos, _vectors[0]));
        }
        if (details.quat) {
            transform.setRotation(castQuaternion(details.quat, _quaternions[0]));
        }
        _object.setWorldTransform(transform);
        _object.activate();
    };

    public_functions.updateMass = function (details) {
        // TODO: changing a static object into dynamic is buggy
        // TODO how to deal with constraints?
        _object = _objects[details.id];

        // Per http://www.bulletphysics.org/Bullet/phpBB3/viewtopic.php?p=&f=9&t=3663#p13816
        world.removeRigidBody(_object);

        var vec = new Ammo.btVector3(0, 0, 0); //TODO local inertia?

        _object.setMassProps(details.mass, vec);
        world.addRigidBody(_object);
        _object.activate();
    };

    public_functions.applyCentralImpulse = function (details) {
        _objects[details.id].applyCentralImpulse(castVector(details, _vectors[0]));
        _objects[details.id].activate();
    };

    public_functions.applyImpulse = function (details) {
        _objects[details.id].applyImpulse(
            castVector({x: details.impulse_x, y: details.impulse_y, z: details.impulse_z}, _vectors[0]),
            castVector(details, _vectors[1])
        );
        _objects[details.id].activate();
    };

    public_functions.applyCentralForce = function (details) {
        _objects[details.id].applyCentralForce(castVector(details, _vectors[0]));
        _objects[details.id].activate();
    };

    public_functions.applyTorque = function (details) {
        _objects[details.id].applyTorque(castVector(details, _vectors[0]));
        _objects[details.id].activate();
    };

    public_functions.applyForce = function (details) {
        _objects[details.id].applyForce(
            castVector({x: details.force_x, y: details.force_y, z: details.force_z}, _vectors[0]),
            castVector(details, _vectors[1])
        );
        _objects[details.id].activate();
    };

    public_functions.setAngularVelocity = function (details) {
        if (_objects[details.id]) {
            _objects[details.id].setAngularVelocity(
                castVector(details, _vectors[0])
            );
            _objects[details.id].activate();
        } else {
            console.log("Missing object id=" + details.id);
        }
    };

    public_functions.setLinearVelocity = function (details) {
        if (_objects[details.id]) {
            _objects[details.id].setLinearVelocity(
                castVector(details, _vectors[0])
            );
            _objects[details.id].activate();
        } else {
            console.log("Missing object id=" + details.id);
        }
    };

    public_functions.setAngularFactor = function (details) {
        _objects[details.id].setAngularFactor(
            castVector(details, _vectors[0])
        );
    };

    public_functions.setLinearFactor = function (details) {
        _objects[details.id].setLinearFactor(
            castVector(details, _vectors[0])
        );
    };

    public_functions.setDamping = function (details) {
        _objects[details.id].setDamping(details.linear, details.angular);
    };

    public_functions.setCcdMotionThreshold = function (details) {
        //console.log("setCcdMotionThreshold"); console.log(details);
        _objects[details.id].setCcdMotionThreshold(details.threshold);
    };

    public_functions.setCcdSweptSphereRadius = function (details) {
        //console.log("setCcdSweptSphereRadius"); console.log(details);
        _objects[details.id].setCcdSweptSphereRadius(details.radius);
    };

    public_functions.addConstraint = function (details) {
        var constraint, transforma, transformb, rotation, xaxis, yaxis, zaxis, basis;
        switch (details.type) {

            case 'point':

                if (details.objectb === undefined) {
                    constraint = new Ammo.btPoint2PointConstraint(
                        _objects[ details.objecta ],
                        castVector(details.positiona, _vectors[0])
                    );
                } else {
                    constraint = new Ammo.btPoint2PointConstraint(
                        _objects[ details.objecta ],
                        _objects[ details.objectb ],
                        castVector(details.positiona, _vectors[0]),
                        castVector(details.positionb, _vectors[1])
                    );
                }
                break;

            case 'hinge':
                if (details.objectb) {

                    constraint = new Ammo.btHingeConstraint(
                        _objects[ details.objecta ],
                        _objects[ details.objectb ],
                        castVector(details.positiona, _vectors[0]),
                        castVector(details.positionb, _vectors[1]),
                        castVector(details.axisa, _vectors[2]),
                        castVector(details.axisb, _vectors[3]),
                        true
                    );

                } else {
                    constraint = new Ammo.btHingeConstraint(
                        _objects[ details.objecta ],
                        castVector(details.positiona, _vectors[0]),
                        castVector(details.axisa, _vectors[1])
                    );
                }
                break;

            case 'slider':

                transforma = new Ammo.btTransform();
                transforma.setOrigin(castVector(details.positiona, _vectors[0]));

                yaxis = castVector(details.axisa, _vectors[1]);
                zaxis = castVector(details.fronta, _vectors[2]);
                xaxis = yaxis.cross(zaxis).normalize();
                //http://math.stackexchange.com/questions/53368/rotation-matrices-using-a-change-of-basis-approach
                basis = transforma.getBasis();
                //set the new coordinate system and swap x, y
                basis.setValue(
                    yaxis.getX(), xaxis.getX(), zaxis.getX(),
                    yaxis.getY(), xaxis.getY(), zaxis.getY(),
                    yaxis.getZ(), xaxis.getZ(), zaxis.getZ()
                );
                transforma.setBasis(basis);

                if (details.objectb) {
                    transformb = new Ammo.btTransform();
                    transformb.setOrigin(castVector(details.positionb, _vectors[4]));

                    if (true) {
                        yaxis = castVector(details.axisb, _vectors[1]);
                        zaxis = castVector(details.frontb, _vectors[2]);
                        xaxis = yaxis.cross(zaxis).normalize();
                        //http://math.stackexchange.com/questions/53368/rotation-matrices-using-a-change-of-basis-approach
                        basis = transformb.getBasis();
                        //set the new coordinate system and swap x, y
                        basis.setValue(
                            yaxis.getX(), xaxis.getX(), zaxis.getX(),
                            yaxis.getY(), xaxis.getY(), zaxis.getY(),
                            yaxis.getZ(), xaxis.getZ(), zaxis.getZ()
                        );
                        transformb.setBasis(basis);
                    }
                    constraint = new Ammo.btSliderConstraint(
                        _objects[ details.objecta ],
                        _objects[ details.objectb ],
                        transforma,
                        transformb,
                        true
                    );
                } else {
                    constraint = new Ammo.btSliderConstraint(
                        _objects[ details.objecta ],
                        transforma,
                        true
                    );
                }

                Ammo.destroy(transforma);
                if (transformb != undefined) {
                    Ammo.destroy(transformb);
                }
                break;

            case 'conetwist':

                transforma = new Ammo.btTransform();
                transforma.setIdentity();

                transformb = new Ammo.btTransform();
                transformb.setIdentity();

                transforma.setOrigin(castVector(details.positiona, _vectors[0]));
                transformb.setOrigin(castVector(details.positionb, _vectors[1]));

                rotation = transforma.getRotation();
                rotation.setEulerZYX(-details.axisa.z, -details.axisa.y, -details.axisa.x);
                transforma.setRotation(rotation);

                rotation = transformb.getRotation();
                rotation.setEulerZYX(-details.axisb.z, -details.axisb.y, -details.axisb.x);
                transformb.setRotation(rotation);

                constraint = new Ammo.btConeTwistConstraint(
                    _objects[ details.objecta ],
                    _objects[ details.objectb ],
                    transforma,
                    transformb
                );

                constraint.setLimit(Math.PI, 0, Math.PI);

                Ammo.destroy(transforma);
                Ammo.destroy(transformb);

                break;

            case 'dof':

                transforma = new Ammo.btTransform();
                transforma.setIdentity();

                transforma.setOrigin(castVector(details.positiona, _vectors[0]));

                rotation = transforma.getRotation();
                rotation.setEulerZYX(-details.axisa.z, -details.axisa.y, -details.axisa.x);
                transforma.setRotation(rotation);

                if (details.objectb) {
                    transformb = new Ammo.btTransform();
                    transformb.setIdentity();
                    transformb.setOrigin(castVector(details.positionb, _vectors[1]));

                    rotation = transformb.getRotation();
                    rotation.setEulerZYX(-details.axisb.z, -details.axisb.y, -details.axisb.x);
                    transformb.setRotation(rotation);

                    constraint = new Ammo.btGeneric6DofConstraint(
                        _objects[ details.objecta ],
                        _objects[ details.objectb ],
                        transforma,
                        transformb
                    );
                } else {
                    constraint = new Ammo.btGeneric6DofConstraint(
                        _objects[ details.objecta ],
                        transforma
                    );
                }
                Ammo.destroy(transforma);
                if (transformb != undefined) {
                    Ammo.destroy(transformb);
                }
                break;

            default:
                console.log("constraint type does not exist:");
                console.log(details);
                return;

        }
        world.addConstraint(constraint);

        constraint.enableFeedback();
        _constraints[ details.id ] = constraint;
        _num_constraints++;

        if (SUPPORT_TRANSFERABLE) {
            constraintreport = new Float32Array(1 + _num_constraints * CONSTRAINTREPORT_ITEMSIZE); // message id & ( # of objects to report * # of values per object )
            constraintreport[0] = MESSAGE_TYPES.CONSTRAINTREPORT;
        } else {
            constraintreport = [ MESSAGE_TYPES.CONSTRAINTREPORT ];
        }
        transferableMessage({ cmd: 'constraintReady', params: details.id });
    };

    public_functions.removeConstraint = function (details) {
        var constraint = _constraints[ details.id ];
        if (constraint !== undefined) {
            world.removeConstraint(constraint);
            delete _constraints[ details.id ];
            _num_constraints--;
        }
    };

    public_functions.constraint_setBreakingImpulseThreshold = function (details) {
        var constraint = _constraints[ details.id ];
        if (constraint !== undefind) {
            constraint.setBreakingImpulseThreshold(details.threshold);
        }
    };

    public_functions.pause = function (params) {
        if (params.pause) {
            pause = true;
        } else {
            pause = false;
            last_simulation_time = Date.now();
        }
    };

    public_functions.simulate = function (params) {
        if (world) {
            if (pause) {
                return;
            }
            if (!params.timeStep) {
                if (last_simulation_time) {
                    params.timeStep = 0;
                    while (params.timeStep + last_simulation_duration <= fixedTimeStep) {
                        params.timeStep = ( Date.now() - last_simulation_time ) / 1000; // time since last simulation
                    }
                } else {
                    params.timeStep = fixedTimeStep; // handle first frame
                }
            } else {
                if (params.timeStep < fixedTimeStep) {
                    params.timeStep = fixedTimeStep;
                }
            }
            params.maxSubSteps = params.maxSubSteps || Math.ceil(params.timeStep / fixedTimeStep); // If maxSubSteps is not defined, keep the simulation fully up to date

            last_simulation_duration = Date.now();
            world.stepSimulation(params.timeStep, params.maxSubSteps, fixedTimeStep);
            reportVehicles();
            reportCollisions();
            reportConstraints();
            reportWorld();
            var now = Date.now();
            last_simulation_duration = ( now - last_simulation_duration ) / 1000;

            last_simulation_time = now;
        }
    };

// Constraint functions
    public_functions.hinge_setLimits = function (params) {
        //NUNO CHANGE
        var softness = 0.9;
        var relax = params.relaxation_factor === undefined ? 1.0 : params.relaxation_factor;
        var bias = params.bias_factor === undefined ? 0.3 : params.bias_factor;
        _constraints[ params.constraint ].setLimit(params.low, params.high, softness, bias, relax);
    };
    public_functions.hinge_enableAngularMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.enableAngularMotor(true, params.velocity, params.acceleration);
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.hinge_disableMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.enableMotor(false);
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.slider_setLimits = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setLowerLinLimit(params.lin_lower || 0);
        constraint.setUpperLinLimit(params.lin_upper || 0);

        constraint.setLowerAngLimit(params.ang_lower || 0);
        constraint.setUpperAngLimit(params.ang_upper || 0);
    };
    public_functions.slider_setRestitution = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setSoftnessLimLin(params.linear || 0);
        constraint.setSoftnessLimAng(params.angular || 0);
    };
    public_functions.slider_enableLinearMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setTargetLinMotorVelocity(params.velocity);
        constraint.setMaxLinMotorForce(params.acceleration);
        constraint.setPoweredLinMotor(true);
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.slider_disableLinearMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setPoweredLinMotor(false);
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.slider_enableAngularMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setTargetAngMotorVelocity(params.velocity);
        constraint.setMaxAngMotorForce(params.acceleration);
        constraint.setPoweredAngMotor(true);
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.slider_disableAngularMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setPoweredAngMotor(false);
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };

    public_functions.conetwist_setLimit = function (params) {
        _constraints[ params.constraint ].setLimit(params.z, params.y, params.x); // ZYX order
    };
    public_functions.conetwist_enableMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.enableMotor(true);
        constraint.getRigidBodyA().activate();
        constraint.getRigidBodyB().activate();
    };
    public_functions.conetwist_setMaxMotorImpulse = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setMaxMotorImpulse(params.max_impulse);
        constraint.getRigidBodyA().activate();
        constraint.getRigidBodyB().activate();
    };
    public_functions.conetwist_setMotorTarget = function (params) {
        var constraint = _constraints[ params.constraint ];

        constraint.setMotorTarget(castQuaternion(params, _quaternions[0]));

        constraint.getRigidBodyA().activate();
        constraint.getRigidBodyB().activate();
    };
    public_functions.conetwist_disableMotor = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.enableMotor(false);
        constraint.getRigidBodyA().activate();
        constraint.getRigidBodyB().activate();
    };

    public_functions.dof_setLinearLowerLimit = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setLinearLowerLimit(castVector(params, _vectors[0]));
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.dof_setLinearUpperLimit = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setLinearUpperLimit(castVector(params, _vectors[0]));
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.dof_setAngularLowerLimit = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setAngularLowerLimit(castVector(params, _vectors[0]));
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.dof_setAngularUpperLimit = function (params) {
        var constraint = _constraints[ params.constraint ];
        constraint.setAngularUpperLimit(castVector(params, _vectors[0]));
        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.dof_enableAngularMotor = function (params) {
        var constraint = _constraints[ params.constraint ];

        var motor = constraint.getRotationalLimitMotor(params.which);
        motor.set_m_enableMotor(true);

        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.dof_configureAngularMotor = function (params) {
        var constraint = _constraints[ params.constraint ];

        var motor = constraint.getRotationalLimitMotor(params.which);

        motor.set_m_loLimit(params.low_angle);
        motor.set_m_hiLimit(params.high_angle);
        motor.set_m_targetVelocity(params.velocity);
        motor.set_m_maxMotorForce(params.max_force);

        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };
    public_functions.dof_disableAngularMotor = function (params) {
        var constraint = _constraints[ params.constraint ];

        var motor = constraint.getRotationalLimitMotor(params.which);
        motor.set_m_enableMotor(false);

        constraint.getRigidBodyA().activate();
        if (constraint.getRigidBodyB()) {
            constraint.getRigidBodyB().activate();
        }
    };

    reportWorld = function () {
        var index, object,
            transform, origin, rotation,
            offset = 0,
            i = 0;

        if (SUPPORT_TRANSFERABLE) {
            if (worldreport.length < 2 + _num_objects * WORLDREPORT_ITEMSIZE) {
                worldreport = new Float32Array(
                    2 + // message id & # objects in report
                        ( Math.ceil(_num_objects / REPORT_CHUNKSIZE) * REPORT_CHUNKSIZE ) * WORLDREPORT_ITEMSIZE // # of values needed * item size
                );
                worldreport[0] = MESSAGE_TYPES.WORLDREPORT;
            }
        }

        worldreport[1] = _num_objects; // record how many objects we're reporting on

        //for ( i = 0; i < worldreport[1]; i++ ) {
        for (index in _objects) {
            if (_objects.hasOwnProperty(index)) {
                object = _objects[index];

                // #TODO: we can't use center of mass transform when center of mass can change,
                //        but getMotionState().getWorldTransform() screws up on objects that have been moved
                //object.getMotionState().getWorldTransform( transform );
                transform = object.getCenterOfMassTransform();

                origin = transform.getOrigin();
                rotation = transform.getRotation();

                // add values to report
                offset = 2 + (i++) * WORLDREPORT_ITEMSIZE;

                worldreport[ offset ] = object.id;

                worldreport[ offset + 1 ] = origin.x();
                worldreport[ offset + 2 ] = origin.y();
                worldreport[ offset + 3 ] = origin.z();

                worldreport[ offset + 4 ] = rotation.x();
                worldreport[ offset + 5 ] = rotation.y();
                worldreport[ offset + 6 ] = rotation.z();
                worldreport[ offset + 7 ] = rotation.w();

                _vector = object.getLinearVelocity();
                worldreport[ offset + 8 ] = _vector.x();
                worldreport[ offset + 9 ] = _vector.y();
                worldreport[ offset + 10 ] = _vector.z();

                _vector = object.getAngularVelocity();
                worldreport[ offset + 11 ] = _vector.x();
                worldreport[ offset + 12 ] = _vector.y();
                worldreport[ offset + 13 ] = _vector.z();
            }
        }


        if (SUPPORT_TRANSFERABLE) {
            transferableMessage(worldreport.buffer, [worldreport.buffer]);
        } else {
            transferableMessage(worldreport);
        }

    };

    reportCollisions = function () {
        var i, offset,
            dp = world.getDispatcher(),
            num = dp.getNumManifolds(),
            manifold, num_contacts, j, pt,
            _collided = false;

        if (SUPPORT_TRANSFERABLE) {
            if (collisionreport.length < 2 + num * COLLISIONREPORT_ITEMSIZE) {
                collisionreport = new Float32Array(
                    2 + // message id & # objects in report
                        ( Math.ceil(_num_objects / REPORT_CHUNKSIZE) * REPORT_CHUNKSIZE ) * COLLISIONREPORT_ITEMSIZE // # of values needed * item size
                );
                collisionreport[0] = MESSAGE_TYPES.COLLISIONREPORT;
            }
        }

        collisionreport[1] = 0; // how many collisions we're reporting on

        for (i = 0; i < num; i++) {
            manifold = dp.getManifoldByIndexInternal(i);

            num_contacts = manifold.getNumContacts();
            if (num_contacts === 0) {
                continue;
            }

            for (j = 0; j < num_contacts; j++) {
                pt = manifold.getContactPoint(j);
                //if ( pt.getDistance() < 0 ) {
                offset = 2 + (collisionreport[1]++) * COLLISIONREPORT_ITEMSIZE;
                collisionreport[ offset ] = _objects_ammo[ manifold.getBody0() ];
                collisionreport[ offset + 1 ] = _objects_ammo[ manifold.getBody1() ];
                break;
                //}

                transferableMessage(_objects_ammo);

            }
        }


        if (SUPPORT_TRANSFERABLE) {
            transferableMessage(collisionreport.buffer, [collisionreport.buffer]);
        } else {
            transferableMessage(collisionreport);
        }
    };

    reportVehicles = function () {
        var index, vehicle,
            transform, origin, rotation,
            offset = 0,
            i = 0, j = 0;

        if (SUPPORT_TRANSFERABLE) {
            if (vehiclereport.length < 2 + _num_wheels * VEHICLEREPORT_ITEMSIZE) {
                vehiclereport = new Float32Array(
                    2 + // message id & # objects in report
                        ( Math.ceil(_num_wheels / REPORT_CHUNKSIZE) * REPORT_CHUNKSIZE ) * VEHICLEREPORT_ITEMSIZE // # of values needed * item size
                );
                vehiclereport[0] = MESSAGE_TYPES.VEHICLEREPORT;
            }
        }

        for (index in _vehicles) {
            if (_vehicles.hasOwnProperty(index)) {
                vehicle = _vehicles[index];

                for (j = 0; j < vehicle.getNumWheels(); j++) {

                    //vehicle.updateWheelTransform( j, true );

                    //transform = vehicle.getWheelTransformWS( j );
                    transform = vehicle.getWheelInfo(j).get_m_worldTransform();

                    origin = transform.getOrigin();
                    rotation = transform.getRotation();

                    // add values to report
                    offset = 1 + (i++) * VEHICLEREPORT_ITEMSIZE;

                    vehiclereport[ offset ] = index;
                    vehiclereport[ offset + 1 ] = j;

                    vehiclereport[ offset + 2 ] = origin.x();
                    vehiclereport[ offset + 3 ] = origin.y();
                    vehiclereport[ offset + 4 ] = origin.z();

                    vehiclereport[ offset + 5 ] = rotation.x();
                    vehiclereport[ offset + 6 ] = rotation.y();
                    vehiclereport[ offset + 7 ] = rotation.z();
                    vehiclereport[ offset + 8 ] = rotation.w();

                }

            }
        }

        if (j !== 0) {
            if (SUPPORT_TRANSFERABLE) {
                transferableMessage(vehiclereport.buffer, [vehiclereport.buffer]);
            } else {
                transferableMessage(vehiclereport);
            }
        }
    };

    reportConstraints = function () {
        var index, constraint,
            offset_body,
            transform, origin,
            offset = 0,
            i = 0;
        transform = new Ammo.btTransform;
        if (SUPPORT_TRANSFERABLE) {
            if (constraintreport.length < 2 + _num_constraints * CONSTRAINTREPORT_ITEMSIZE) {
                constraintreport = new Float32Array(
                    2 + // message id & # objects in report
                        ( Math.ceil(_num_constraints / REPORT_CHUNKSIZE) * REPORT_CHUNKSIZE ) * CONSTRAINTREPORT_ITEMSIZE // # of values needed * item size
                );
                constraintreport[0] = MESSAGE_TYPES.CONSTRAINTREPORT;
            }
        }

        for (index in _constraints) {
            if (_constraints.hasOwnProperty(index)) {
                constraint = _constraints[index];
                offset_body = constraint.getRigidBodyA();
                //TODO verify these changes
                if (constraint.getFrameOffsetA) {
                    transform = constraint.getFrameOffsetA();
                } else {
                    transform.setIdentity();
                }
                origin = transform.getOrigin();

                // add values to report
                offset = 1 + (i++) * CONSTRAINTREPORT_ITEMSIZE;

                constraintreport[ offset ] = index;
                constraintreport[ offset + 1 ] = offset_body.id;
                constraintreport[ offset + 2 ] = origin.getX();
                constraintreport[ offset + 3 ] = origin.getY();
                constraintreport[ offset + 4 ] = origin.getZ();
                constraintreport[ offset + 5 ] = constraint.getAppliedImpulse();
            }
        }


        if (i !== 0) {
            if (SUPPORT_TRANSFERABLE) {
                transferableMessage(constraintreport.buffer, [constraintreport.buffer]);
            } else {
                transferableMessage(constraintreport);
            }
        }

    };
    var referenceTime = Date.now();

    self.onmessage = function (event) {

        if (event.data instanceof ArrayBuffer) {
            try {
                var f32 = new Float32Array(event.data);
                switch (f32[0]) {
                    case MESSAGE_TYPES.WORLDREPORT:
                        worldreport = f32;
                        break;

                    case MESSAGE_TYPES.COLLISIONREPORT:
                        collisionreport = f32;
                        break;

                    case MESSAGE_TYPES.VEHICLEREPORT:
                        vehiclereport = f32;
                        break;

                    case MESSAGE_TYPES.CONSTRAINTREPORT:
                        constraintreport = f32;
                        break;
                }
            } catch (e) {
            }
            return;
        }

        if (event.data.cmd && public_functions[event.data.cmd]) {
            //if ( event.data.params.id !== undefined && _objects[event.data.params.id] === undefined && event.data.cmd !== 'addObject' && event.data.cmd !== 'registerMaterial' ) return;
            public_functions[event.data.cmd](event.data.params);
        }

    };
})();