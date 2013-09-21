'use strict';

/*
 * The served database communicates with Assemblino.com and local databases to gather data
 */
function ServedDatabase(staticComponents) {
    this.objects = _.clone(staticComponents);
    _.map(staticComponents, function (value, key) {
        delete staticComponents[key];
    });
    this.sessionInfo = {
        lastEdited: 'KeyboardControls2',
        user: "",
        arduino: false,
        boardPath: "/dev/ttyUSB0",
        desktopFiles: []
    };
    this.localDatabase = {};
    this.publicUsers = [
        'public','Public','Vendor','Commercial','Store','Shop','Database','Abstract','Components','Basic','Geometric',
        'Learning','Tutorial','Tutorials','Example','Examples', 'Demos','Assembler','Assemblino','Tests','Trash','Robots','Desktop','Local','Server',
        'Playground'
    ];
}

ServedDatabase.prototype.fileKey = 'Assemblino Object and Dependencies';

ServedDatabase.prototype.newID = function () {
    return Math.round(Math.abs((Date.now() - new Date("2013-01-01").valueOf()) / 1000));
};

ServedDatabase.prototype.set = function (object) {
    if (!object) return;
    this.objects[object.id] = object;
};

ServedDatabase.prototype.get = function (id) {
    return this.objects[id];
};

ServedDatabase.prototype.getByName = function (name) {
    for (var a in this.objects) {
        if (this.objects[a].name == name) {
            return this.objects[a];
        }
    }
    return undefined;
};

var TRACKER = {
    dependencies: [],
    isTracking: false,
    tracking: "",
    make: function (name) {
        return "TRACKER.track('" + name + "');\n";
    },
    track: function (name) {
        this.checkRecursion(name);
        if (this.dependencies.indexOf(name) < 0) {
            this.dependencies.push(name)
        }
    },
    clear: function (newTracking) {
        while (this.dependencies.length) {
            this.dependencies.pop();
        }
        this.tracking = newTracking;
    },
    checkRecursion: function (name) {
        if (name != this.tracking) return;
        throw ("Recursion loop identified for '" + name + "'. \n\nObject will not be inserted.");
    },
    checkAvailability: function (dependencies) {
        var missing = [];
        for (var i = 0; i < dependencies.length; i++) {
            if (!Assembler.database.getByName(dependencies[i])) missing.push(dependencies[i]);
        }
        return missing.join(',\n');
    },
    checkCorrectness: function (dependencies) {
        var failures = [];
        for (var i = 0; i < dependencies.length; i++) {
            var obj = Assembler.database.getByName(dependencies[i]);
            if (obj && !codeObject(obj.code)) failures.push(dependencies[i]);
        }
        return failures.join(',\n');
    }
};

ServedDatabase.prototype.defineObject = function (name, container) {
    var _this = this;
    container = container || window;
    container[name] = function () {
        var obj = _this.get(name) || _this.getByName(name);
        var objName = obj.name;
        var fun = new Function(TRACKER.make(objName) + obj.code);
        if (fun) {
            return fun(arguments[0]);
        } else {
            return null;
        }
    };
};

ServedDatabase.prototype.hasObject = function (name) {
    return this.getByName(name);
};

ServedDatabase.prototype.getSessionInfo = function (callback) {
    var _this = this;
    postRequest("/getInfo", {},
        function (info) {
            info = JSON.parse(info);
            _.extend(_this.sessionInfo, JSON.parse(info.info));
            _.extend(_this.sessionInfo, info);
            delete _this.sessionInfo.info;
            DESKTOP_OPTIONS.enabled = !!_this.sessionInfo.desktopFiles.length;
            callback(info);
        }
    );
};

ServedDatabase.prototype.makePublic = function (data, callback) {
    postRequest("/makePublic", data, callback);
};

ServedDatabase.prototype.requestOnlyDiffs = function (callback) {
    var _this = this;
    var states = {};
    var afterBoth = function () {
        if (!states.server || !states.local) {
            return;
        }
        var toRequest = [];
        var newComponents = [];
        //identify components which are in the server but not in the local or served database, set them to be requested and inserted
        _.map(states.server, function (value, key) {
            if (_this.objects[key] === undefined && states.local[key] === undefined) {
                newComponents.push(key);
                toRequest.push(key);
            }
        });
        var changedComponents = [];
        //identify components whose change time in the local database are different from the server, and set them to be requested
        _.map(states.server, function (value, key) {
            if (states.local[key] !== undefined && (states.local[key] < states.server[key])) {
                console.log("downloading " + key + " from server:" + states.server[key] + " ---->  local:" + states.local[key]);
                changedComponents.push(key);
                toRequest.push(key);
            }
        });
        //identify components whose change time in the downloaded components file are different from server (publicUsers)
        if (_this.userIsPublic()) {
            _.map(states.server, function (value, key) {
                var fileObj = _this.get(key);
                if (fileObj && (fileObj.last_change < states.server[key])) {
                    console.log("downloading public " + key + " from server:" + states.server[key] + " ---->  static:" + fileObj.last_change);
                    changedComponents.push(key);
                    toRequest.push(key);
                } else if (fileObj && !states.server[key]) {
                    //object was deleted
                    delete _this.objects[key];
                }
            });
        }
        toRequest = _.uniq(toRequest);
        var processRequested = function processRequested(response) {
            response = JSON.parse(response);
            newComponents.map(function (id) {
                _this.localDatabase.insertComponent(response[id]);
                _this.localDatabase.insertHistory(response[id], 0);
                _this.set(response[id]);
            });
            changedComponents.map(function (id) {
                _this.localDatabase.updateComponent(response[id]);
                _this.set(response[id]);
            });
            //if objects in local database are not in the served database, push them to the served database
            _this.localDatabase.getAllComponents(function (list) {
                list.map(function (o) {
                    var current = _this.get(o.id);
                    if (!current || current.last_change < o.last_change) {
                        _this.set(JSON.parse(o.obj));
                    }
                });
                callback();
            });
        };
        if (toRequest.length) {
            Assembler.toggleSymbol(true, "Requesting changed components...");
            _this.requestList(toRequest, processRequested);
        } else {
            processRequested("{}");
        }
    };
    var localCallback = function (list2) {
        states.local = list2;
        afterBoth();
    };
    var serverCallback = function (list3) {
        states.server = JSON.parse(list3);
        afterBoth();
    };
    if (this.getUsername()) {
        socketRequest("/changes", {}, serverCallback);
    } else {
        setTimeout(
            function () {
                serverCallback("{}");
            }, 0);
    }
    _this.localDatabase.getLocalLastChanges(localCallback);
    _this.localDatabase.deleteOldHistory();
};

ServedDatabase.prototype.requestList = function (list, renderFunc) {
    socketRequest("/getlist", {list: list}, renderFunc);
};

ServedDatabase.prototype.insertComponent = function (name, code, settings, id, date) {
    id || (id = this.newID());
    date || (date = Date.now());
    this.set({id: id, name: name, code: code, settings: settings, last_change: date});
    this.localDatabase.insertComponent(this.get(id));
    this.localDatabase.insertHistory(this.get(id), 0);
    if (this.getUsername() && this.localDatabase.usesSQLite) {
        postRequest("/insert", this.get(id));
    }
    return _.clone(this.get(id));
};

ServedDatabase.prototype.updateComponent = function (obj) {
    this.set({id: obj.id, name: obj.name, code: obj.code, settings: obj.settings, last_change: obj.last_change});
    this.localDatabase.updateComponent(this.get(obj.id));
    if (this.getUsername() && this.localDatabase.usesSQLite) {
        postRequest("/update", this.get(obj.id));
    }
};

ServedDatabase.prototype.saveSessionInfoToServer = function () {
    delete this.sessionInfo.info;
    this.getUsername() && postRequest("/saveInfo", {info: JSON.stringify(this.sessionInfo)});
};

ServedDatabase.prototype.saveLastEdited = function (value) {
    this.localDatabase.updateOption('lastEdited', "" + value);
};

ServedDatabase.prototype.deleteComponent = function (id, prompt) {
    var dependants = this.searchDependants(this.objects[id].name);
    if (!dependants.length) {
        dependants = "";
    } else {
        dependants = _.pluck(_.pick(this.objects, dependants), 'name').join('\n');

    }
    if (prompt && !confirm("Delete '" + this.get(id).name + "'?" + (dependants ? ("\n\nThis will eventually crash the following dependants:\n\n" + dependants) : ""))) {
        return false;
    }
    delete this.objects[id];
    this.getUsername() && postRequest("/delete", {id: id, last_change: Date.now()});
    this.localDatabase.deleteComponent(id);
    this.localDatabase.deleteObjectHistory(id);
    return true;
};

ServedDatabase.prototype.listComponents = function (menu) {
    var list = menu.orderComponentsByFolder(this.objects);
    for (var i = 0; i < list.length; i++) {
        menu.addComponentToGui(list[i]);
    }
};

ServedDatabase.prototype.defineAllComponentFunctions = function (toContainer) {
    var _this = this;
    _.map(this.objects, function (obj) {
        _this.defineObject(obj.name, toContainer);
    });
};

ServedDatabase.prototype.registerAllComponents = function (toContainer, menu) {
    this.defineAllComponentFunctions(toContainer);
    this.listComponents(menu);
};

ServedDatabase.prototype.saveInfo = function (parameter, value) {
    if (!this.sessionInfo) {
        var sets = this.getDefaultOptions();
        sets[parameter] = value;
    }
    this.sessionInfo[parameter] = value;
};

ServedDatabase.prototype.getInfo = function (parameter) {
    if (this.sessionInfo && this.sessionInfo[parameter] !== undefined) {
        return this.sessionInfo[parameter];
    }
    return this.getDefaultOptions()[parameter];
};

ServedDatabase.prototype.getUsername = function () {
    return this.sessionInfo.user;
};

ServedDatabase.prototype.userIsPublic = function (user) {
    return this.publicUsers.indexOf(user || this.sessionInfo.user) > -1;
};

ServedDatabase.prototype.isDesktopFile = function (name) {
    return this.sessionInfo.desktopFiles.indexOf(name + ".js") > -1;
};

ServedDatabase.prototype.search = function (regx) {
    //search for text or regex and list component names that match
    var _this = this;
    return _.pluck(_.pick(this.objects, _.filter(_.keys(this.objects), function (id) {
        var obj = _this.get(id);
        return obj.name.match(regx) || obj.code.match(regx) || obj.settings.match(regx);
    })), 'name');
};

ServedDatabase.prototype.searchDependants = function (name, includeName) {
    //in which other components it appears? check for dependants and return a list of their ids
    var _this = this;
    return _.filter(_.keys(this.objects), function (id) {
        var obj = _this.get(id);
        if (obj.name === name) {
            return !!includeName;
        }
        var settings = JSON.parse(obj.settings);
        var options = settings.options;
        return options && options.dependencies && _.contains(options.dependencies, name);
    });
};

ServedDatabase.prototype.rename = function (name, newName, dependants) {
    //attention, it will not rename content in files, just in the database
    if (!Assembler.manager.objectIsMine()) {
        notify("Can't rename not owned object '" + name + "'.");
        return;
    }
    var debug = false;
    var cleanedName = flexibleName(newName);
    if (name === newName) return;
    if (!cleanedName) {
        notify("'" + newName + "' is not suitable for replacing '" + name + "'.");
        return;
    }
    if (this.searchDependants(cleanedName, true).length) {
        notify("Operation aborted!\n\n'" + newName + "' already names a database object.");
        return;
    }
    if (!dependants) {
        dependants = _.pick(this.objects, this.searchDependants(name));
    }
    if (_.keys(dependants).length) {
        var objNames = _.pluck(_.pick(this.objects, _.keys(dependants)), 'name').join('\n');
        if (!confirm("'" + name + "' will be renamed to '" + cleanedName + "' affecting \n\n" + objNames)) return;
    } else {

    }
    var _this = this;
    var codeRegex1 = new RegExp("[\'\"]" + name + "[\'\"]", 'gm'); //new form
    var codeRegex2 = new RegExp("OBJECTS." + name, 'gm'); //old form
    _.map(dependants, function (obj) {
        var changed = false;
        debug && console.log('renaming in: ', obj.name);
        var code = obj.code;
        debug && console.log('c before: ', code);
        code = code.replace(codeRegex1, "\'" + cleanedName + "\'");
        code = code.replace(codeRegex2, "OBJECTS['" + cleanedName + "']");
        if (code !== obj.code) {
            obj.code = code;
            changed = true;
        }
        debug && console.log('c after: ', code);
        var settings = JSON.parse(obj.settings);
        var options = settings.options;
        var index = options.dependencies.indexOf(name);
        if (index > -1) {
            debug && console.log('d before: ', options.dependencies);
            options.dependencies[index] = cleanedName;
            debug && console.log('d after: ', options.dependencies);
            obj.settings = JSON.stringify(settings);
            changed = true;
        }
        if (changed) {
            obj.last_change = Date.now();
            _this.updateComponent(obj);
        }
    });
    var target = this.getByName(name);
    target.name = cleanedName;
    target.last_change = Date.now();
    _this.updateComponent(target);
    this.sessionInfo.lastEdited = cleanedName;
    Assembler.manager.editor.object.name = cleanedName;
    this.saveSessionInfoToServer();
    Assembler.menus.displayCurrentObjectName(cleanedName, this.getUsername(), Assembler.manager.getOption('folder'));
};

ServedDatabase.prototype.updateObjectFromLocalFile = function (obj) {
    var name = obj.name;
    if (!this.isDesktopFile(name)) return false;
    var desk = window[DESKTOP_OPTIONS.globalName];
    if (!desk) {
        desk = new DesktopDevelopment(name);
        window[DESKTOP_OPTIONS.globalName] = desk;
    } else {
        desk.reassign(name);
    }
    if (!desk.validateUser(obj.username)) {
        return false;
    }
    desk.setAsLastEdited();
    desk.extendOptions({codeEditor: false});
    desk.update();
    return true;
};

ServedDatabase.prototype.getDefaultOptions = function () {
    return this.defaultOptions || (this.defaultOptions = {
        pause: false,
        autoStart: true, //auto start program when loaded
        codeEditor: false, //initially show code editor
        codeWrapperHeight: 35, //code editor height and width
        codeWrapperWidth: 50, ////
        softHandling: false, //to use soft or hard handling for objects interactive movements
        renderInterval: 200,
        scenario: "plain",
        showAxis: true,
        showConnectors: true,
        simulationInterval: 30,
        simulationQuality: 5,
        cameraPosition: [60, 60, 60],
        cameraTarget: [0, 0, 0],
        folder: "",
        dependencies: [], //components on which this depends
        connectorRadius: 0.5,
        scale: 'centimeter',
        link: "",
        embed: "",
        data: {}
    });
};


