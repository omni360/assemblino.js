'use strict';

function OperationsManager(editor, database, menus, simulator, compiledObjects) {
    //enclosed objects
    this.localDatabase = database.localDatabase;
    this.servedDatabase = database;
    this.user = database.sessionInfo.user;
    this.editor = editor;
    this.menus = menus;
    menus.manager = this;
    this.simulator = simulator;
    this.compiledObjects = compiledObjects;
    this.defaultOptions = _.clone(database.getDefaultOptions());
    //database parameters
    this.code = ""; //the initially evaluated code to identify an object
    this.program = ""; //for Assembles the Program code, for other objects it is not used
    this.options = {}; //the usual settings: render time, simulation time, quality, etc
    this.owner = this.user; //the owner of the current object
    this.content = Assemble.prototype.newContent(); //for assembles and systems, the information to build the object
    this.objectType = 'System'; //overwritten with setObject
    this.pointer = -1; //the pointer to history. used for undo redo
    //other parameters
    this.object = undefined; //must be set with .setObject
    this.last_change = null;
}

OperationsManager.prototype.getObjectName = function () {
    return this.editor.object && this.editor.object.name;
};

OperationsManager.prototype.getObjectId = function () {
    return this.editor.object && this.editor.object.id;
};

OperationsManager.prototype.objectIsMine = function () {
    return this.user === this.owner;
};

OperationsManager.prototype.saveOption = function (optionName, optionValue) {
    if (!this.isLoaded()) return;
    if (!(this.servedDatabase.getDefaultOptions()[optionName] === undefined)) {
        this.options[optionName] = optionValue;
    } else {
        this.servedDatabase.saveInfo(optionName, optionValue);
    }
};

OperationsManager.prototype.getOption = function (optionName) {
    if (!this.isLoaded()) return undefined;
    if (!(this.servedDatabase.getDefaultOptions()[optionName] === undefined)) {
        return this.options[optionName];
    } else {
        return this.servedDatabase.getInfo(optionName);
    }
};

OperationsManager.prototype.settings = function (settings) {
    if (settings) {
        if (typeof settings == 'string') {
            settings = JSON.parse(settings);
        }
        settings = _.defaults(settings, {
            //code: "",
            program: "",
            options: {},
            owner: "",
            content: Assemble.prototype.newContent(),
            pointer: -1,
            objectType: ""
        });
        _.extend(this, settings);
    }
    settings && _.defaults(settings.options, this.defaultOptions);
    return _.pick(this, [
        'program',
        'options',
        'owner',
        'pointer',
        'objectType']);
};

OperationsManager.prototype.setObject = function (object) {
    this.object = object;
    if (object) {
        this.content = object.content;
    } else {
        var report = this.failureReport();
        notify('Error building ' + this.getObjectName() + (report ? report : ""));
        return;
    }
    this.objectType = object.objectType;
};

OperationsManager.prototype.hasPart = function () {
    return this.objectType.match(/Part/i);
};

OperationsManager.prototype.hasSystem = function () {
    return this.objectType.match(/System/i);
};

OperationsManager.prototype.hasAssemble = function () {
    return this.objectType.match(/Assemble/i);
};

OperationsManager.prototype.updateCode = function (value) {
    if (value !== undefined) {
        this.code = value;
    } else if (this.hasAssemble()) {
        this.program = this.editor.getValue();
        this.code = this.contentAsCode();
    } else if (this.hasSystem()) {
        this.code = this.editor.getValue();
    } else if (this.hasPart()) {
        this.code = this.editor.getValue();
    }
};

OperationsManager.prototype.normalizePointer = function () {
    this.localDatabase.normalizePointer(this.servedDatabase.get(this.getObjectId()), this);
};

OperationsManager.prototype.redo = function () {
    var oldPointer = this.pointer;
    this.pointer++;
    return this.finishUndoRedo(oldPointer);
};

OperationsManager.prototype.undo = function () {
    var oldPointer = this.pointer;
    this.pointer = Math.max(this.pointer - 1, 0);
    return this.finishUndoRedo(oldPointer);
};

OperationsManager.prototype.finishUndoRedo = function (oldPointer) {
    if (oldPointer == this.pointer) return;
    var _this = this;

    function callback(obj) {
        if (!obj) {
            _this.pointer = oldPointer;
            return;
        }
        _this.code = obj.code;
        _this.redraw();
        if (!_this.hasAssemble()) {
            _this.editor.setValue(_this.code);
        } else {
            _this.content = _this.object.content;
            if (obj.settings) {
                _this.editor.setValue(obj.settings.program || "");
            } else {
                _this.editor.setValue("");
            }
        }
        _this.menus.clearContext();
    }

    this.localDatabase.getHistoryPoint(this.getObjectId(), this.pointer, callback);
};

OperationsManager.prototype.updateHistory = function () {
    var _this = this;
    this.last_change = Date.now();
    this.localDatabase.insertHistory({
        id: _this.getObjectId(),
        name: _this.editor.object.name,
        code: _this.code, //remove this and update finishUndoRedo because code is in settings
        settings: _this.settings(),
        last_change: _this.last_change
    }, ++this.pointer);
};

OperationsManager.prototype.updateValueAndHistory = function () {
    this.saveOption('dependencies', TRACKER.dependencies.slice());
    this.updateCode();
    this.updateHistory();
};

OperationsManager.prototype.parseComments = function (obj) {
    var info = "";
    if (typeof obj === 'string') {
        info = obj;
    } else {
        if (typeof obj !== 'object') {
            obj = this.servedDatabase.get(obj) || this.servedDatabase.getByName(obj);
        }
        if (!obj) return "";
        var sets = JSON.parse(obj.settings);
        if (sets.objectType.match(/Assemble/igm)) {
            info = sets.program;
        } else {
            info = obj.code;
        }
    }
    //the correct would be with regex
    var ini = info.indexOf("\/\*");
    if (ini > -1) {
        var end = info.indexOf("\*\/", ini);
        if (end > -1) {
            return info.substring(ini, end);
        }
    }
    return "";
};

OperationsManager.prototype.releaseObject = function () {
    if (!this.object) return;
    this.object.selfDestroy();
    this.object = null;
};

OperationsManager.prototype.isLoaded = function () {
    var value = arguments[0];
    if (value === true || value === false) {
        this._isLoaded = value;
    }
    return !!this._isLoaded;
};

OperationsManager.prototype.failureReport = function () {
    var deps = this.options.dependencies || [];
    var aval = TRACKER.checkAvailability(deps);
    var bugged = TRACKER.checkCorrectness(deps);
    var report = "";
    report += (aval && ("\n\nMissing dependencies:\n" + aval)) || "";
    report += (bugged && ("\n\nFailed to build:\n" + bugged)) || "";
    return report;
};

OperationsManager.prototype.editComponent = function (obj, preCompiledObject) {
    if (!obj) return;
    if (preCompiledObject === undefined && this.servedDatabase.updateObjectFromDesktopFile(obj)) {
        return;
    }
    var _this = this;
    _this.simulator.runProgram = false;
    Assemblino.arduino.clean();
    this.settings(obj.settings);
    this.menus.clearPopMenu();
    this.menus.clearConstraintsGUI();
    this.releaseObject();
    this.simulator.resetScene();
    this.simulator.connectorRadius = this.options.connectorRadius || 0.5;
    this.editor.object = obj;
    TRACKER.clear(obj.name);
    resetNextInt();
    if (preCompiledObject === undefined) {
        preCompiledObject = codeObject(obj.code, null, obj.name);
    }
    if (preCompiledObject) {
        if (preCompiledObject instanceof Assemble) {
            if (!preCompiledObject.isCompiled) {
                preCompiledObject = preCompiledObject.compile(this.program);
            }
            this.editor.setValue(this.program);
        } else if (preCompiledObject instanceof System) {
            this.code = obj.code;
            this.editor.setValue(obj.code);
        } else if (preCompiledObject instanceof Part) {
            this.code = obj.code;
            this.editor.setValue(obj.code);
        }
    } else {
        if (this.objectType.match(/Assemble/igm)) {
            this.editor.setValue(this.program);
        } else {
            this.code = obj.code;
            this.editor.setValue(obj.code);
        }
        this.options.codeEditor = true;
    }
    this.setObject(preCompiledObject);
    this.isLoaded(true);
    this.menus.updateCameraControls();
    this.last_change = obj.last_change;
    this.normalizePointer();
    this.menus.updateOptions();
    if (preCompiledObject) {
        preCompiledObject.addToScene(this.simulator,
            function () {
                _this.simulator.runProgram = !!_this.getOption('autoStart');
            }
        );
    }
    this.menus.displayCurrentObjectName(obj.name, this.owner, this.options.folder);
    this.menus.toggleUserUXControls(true, this.objectIsMine());
    preCompiledObject && this.menus.toggleInteraction(preCompiledObject);
    $("#editorControls").show();
    this.servedDatabase.saveInfo('lastEdited', obj.id);
    this.servedDatabase.saveLastEdited(obj.id);
    this.menus.showInfo(this.parseComments(this.editor.getValue()));
    Assemblino.toggleSymbol(false, "");
    this.simulator.stop = false;
};

OperationsManager.prototype.redraw = function (o) {
    var _this = this;
    _this.simulator.runProgram = false;
    Assemblino.arduino.clean();
    this.menus.clearPopMenu();
    this.menus.clearConstraintsGUI();
    TRACKER.clear(this.getObjectName());
    this.releaseObject();
    this.simulator.clearObject();
    //resetNextInt();
    if (!o) {
        o = codeObject(this.code, null, this.getObjectName());
    }
    if ((o instanceof Assemble) && !o.isCompiled) {
        o = o.compile(this.program);
    }
    this.setObject(o);
    this.isLoaded(true);
    //this.menus.updateCameraControls();
    o && o.addToScene(this.simulator,
        function () {
            _this.simulator.runProgram = !!_this.getOption('autoStart');
        }
    );
    this.menus.updateInfo(this.parseComments(this.editor.getValue()));
    this.menus.closeFolders();
};

OperationsManager.prototype.saveComponent = function () {
    if (!this.objectIsMine()) {
        notify("Can't overwrite " + this.owner + "'s components. Use 'Save As'.");
        return;
    }
    if (this.hasAssemble()) {
        this.saveAllPositions();
    }
    this.updateValueAndHistory();
    var _this = this;
    this.servedDatabase.updateComponent({
        id: _this.getObjectId(),
        name: _this.editor.object.name,
        code: _this.code,
        settings: JSON.stringify(_this.settings()),
        last_change: _this.last_change
    });
    this.servedDatabase.saveInfo('lastEdited', this.editor.object.name);
    this.servedDatabase.defineObject(this.getObjectId(), this.compiledObjects);
    this.servedDatabase.saveSessionInfoToServer();
};

OperationsManager.prototype.saveAsComponent = function () {
    var name = prompt(" name:", this.editor.object.name + "" + (new Date().getUTCMilliseconds()));
    if (!name) {
        return;
    }
    var chosenName = name;
    name = flexibleName(name);
    if (!name || this.servedDatabase.hasObject(name)) {
        notify("The name '" + chosenName + "' has been taken or is not suitable. Choose other name.");
        return;
    }
    if (this.hasAssemble()) {
        this.saveAllPositions();
    }
    this.updateCode();
    var settings = this.settings();
    settings.owner = this.user;
    var obj = this.servedDatabase.insertComponent(name, this.code, JSON.stringify(settings));
    this.menus.addComponentToGui(obj);
    this.editComponent(obj);
    this.saveComponent();
};

OperationsManager.prototype.newComponent = function (type) {
    var name = prompt(type + " name:", type + "" + (new Date().getUTCMilliseconds()));
    if (!name) {
        this.menus.flashStatus('Canceled');
        return;
    }
    var chosenName = name;
    name = flexibleName(name);
    while (!name || this.servedDatabase.hasObject(name)) {
        name = prompt("The name '" + chosenName + "' has been taken or is not suitable. \n\nPlease choose other name:", chosenName);
        if (!name) {
            this.menus.flashStatus('Canceled');
            return;
        }
        chosenName = name;
        name = flexibleName(name);
    }
    var settings = this.settings({});
    settings.owner = this.user || "";
    if (type == 'Part') {
        settings.options.codeEditor = true;
        settings.options.renderInterval = 250;
        settings.options.simulationQuality = 2;
    } else if (type == 'System') {
        settings.options.codeEditor = true;
        settings.options.renderInterval = 200;
        settings.options.simulationQuality = 5;
    } else if (type == 'Assemble') {
        settings.options.codeEditor = false;
        settings.options.renderInterval = 150;
        settings.options.simulationQuality = 10;
        settings.options.scenario = 'desk';
        settings.program = this.assembleProgramTemplate(name);
    }
    var _this = this;
    var code = {
        'Assemble': _this.assembleTemplate,
        'System': _this.systemTemplate,
        'Part': _this.partTemplate
    }[type].call(this, name);
    var obj = this.servedDatabase.insertComponent(name, code || "", JSON.stringify(settings), undefined, Date.now());
    this.servedDatabase.defineObject(obj.name, Assemblino.objects);
    this.menus.addComponentToGui(obj);
    this.editComponent(obj);
    this.saveComponent();
};

OperationsManager.prototype.closeComponent = function (dontAsk) {
    this.isLoaded(false);
    if (!this.getObjectId()) {
        return;
    }
    if (dontAsk || confirm("Close \n" + this.editor.object.name + " ?")) {
        this.simulator.runProgram = false;
        this.simulator.stop = true;
        this.menus.toggleUserUXControls(false);
        this.settings({});
        $("#editing").html("");
        this.editor.object = {};
        this.editor.setValue("");
        this.menus.toggleCodeMirror(false);
        $("#editorControls").hide();
        this.servedDatabase.saveInfo('lastEdited', -1);
        this.menus.clearPopMenu();
        this.menus.clearConstraintsGUI();
        this.releaseObject();
        this.simulator.resetScene();
        this.menus.clearInfo();
        Assemblino.toggleSymbol(true, "Done! Use the menu to open or create new objects.");
        this.simulator.refreshCanvas();
        this.servedDatabase.saveLastEdited("");
    }
};

OperationsManager.prototype.deleteComponent = function () {
    if (!this.objectIsMine()) {
        notify("Can't delete current object.");
        return;
    }
    var name = this.editor.object.name;
    if (this.servedDatabase.deleteComponent(this.getObjectId(), true)) {
        this.menus.removeFromComponentsFolder(name);
        this.closeComponent(true);
        this.isLoaded(false);
        this.menus.clearInfo();
    }
};

OperationsManager.prototype.reload = function (name, precompiledObject) {
    var objectDescription = name ? this.servedDatabase.getByName(name) : this.servedDatabase.get(this.getObjectId());
    this.editComponent(objectDescription, precompiledObject);
};

OperationsManager.prototype.removeChild = function (name) {
    delete this.content.declarations[name];
    delete this.content.physics[name];
    this.removeConnectionsToOrFrom(name);
};

OperationsManager.prototype.removeNetworkFromScene = function (connector) {
    var parts = connector.networkParts();
    var names = {};
    for (var p = 0; p < parts.length; p++) {
        names[parts[p].rootParentName()] = "";
    }
    var _this = this;
    _.map(names, function (v, k) {
        _this.removeChild(k);
    });
};

OperationsManager.prototype.saveAllPositions = function () {
    if (!this.hasAssemble()) return;
    this.content.physics = {};
    var parts = this.object.partsList();
    var id;
    for (var i = 0; i < parts.length; i++) {
        id = parts[i].getKey();
        if (id) {
            this.content.physics[id] = parts[i].getPhysics();
        }
    }
    this.updateAllControllerOptions();
    this.updateContentOptions();
};

OperationsManager.prototype.updateContentOptions = function () {
    this.content.options = (this.object && this.object.getOptions()) || {};
};

OperationsManager.prototype.updateAllControllerOptions = function () {
    var relevant = ['isEnabled', 'rpm', 'angle', 'position']; //this declaration should be somewhere in actuators.js
    var _this = this;
    var fixedConnectors = _.filter(Assemblino.simulator.connectors, function (c) {
        return c.isConnected && c.isFixed;
    });
    var topLevelFixedConnectors = _.filter(fixedConnectors, function (fixed) {
        return !!_this.getConnectOperation(fixed, fixed.pairConnector);
    });
    var deepLevelFixedConnectors = _.difference(fixedConnectors, topLevelFixedConnectors);
    _.map(topLevelFixedConnectors, function (fixed) {
        var control = _this.getConnectOperation(fixed, fixed.pairConnector);
        _.extend(control.controllerOptions, _.pick(fixed.controller.settings.options, relevant));
    });
    var over = [];
    _.map(deepLevelFixedConnectors, function (fixed) {
        var options = _.pick(fixed.controller.settings.options, relevant);
        var connectorKey = fixed.getKey();
        var partKey = fixed.parentPartKey();
        over.push([partKey, connectorKey, options]);
    });
    this.content.connectorOptions = over;
};

var lastSettings = {};

OperationsManager.prototype.autoLoad = function () {
    var id = uriParameter('id') || uriParameter('name') || this.localDatabase.lastEdited || this.servedDatabase.getInfo('lastEdited');
    var dependencies = uriParameter('dependencies');
    if (dependencies) {
        if (Assemblino.database.getUsername()){
            Assemblino.toggleSymbol(true, "Forcing logout...");
            Assemblino.database.sessionInfo.user = "";
            jQuery.ajax("/logout.html", {
                cache: false,
                type: 'GET',
                success: function(){
                    notify('To inspect shared components you were automatically logged out as a normal security procedure.\n\nThis window wil reload.');
                    window.location.reload();
                }
            });
            return;
        }
        Assemblino.toggleSymbol(true, "Fetching dependencies...");
        jQuery.ajax("/show/" + dependencies + ".json", {
            cache: false,
            type: 'GET',
            success: process
        });
    } else {
        process(null);
    }
    function process(json) {
        if (json){
            Assemblino.toggleSymbol(true, "Including contributor's components...");
            _.map(json, function(o,i){
                if (!Assemblino.database.get(o.id)) {
                    Assemblino.database.set(o);
                    Assemblino.menus.addComponentToGui(o);
                }
            });
        }
        var obj = Assemblino.database.get(id) ||  Assemblino.database.getByName(id);
        if (obj) {
            Assemblino.toggleSymbol(true, "Preparing to build and render object...");
            Assemblino.manager.editComponent(obj);
            Assemblino.toggleSymbol(false, "");
        } else {
            Assemblino.menus.toggleUserUXControls(false);
            Assemblino.toggleSymbol(true, "Done! Use the menu to open or create new objects.");
        }
    }
};

OperationsManager.prototype.insertComponentAsChild = function (obj) {
    var _this = this;
    this.menus.clearPopMenu();
    if (!_this.hasAssemble()) {
        notify("Current object is not of type Assemble.");
        return;
    }
    var o = codeObject(obj.code, null, obj.name);
    //this forces the name to be the first item
    var settings = _.extend({name: ""}, lastSettings[obj.name] || o.getOptions() || {});
    settings.name = nextName(settings.name || obj.name);
    while (_this.hasObject(settings.name, _this.getObjectName())) {
        settings.name = nextName(settings.name);
    }
    _.map(o.getSettings(), function (v, k) {
        if (v instanceof Array) {
            var rem = settings[k];
            settings[k] = _.without(v, rem);
            if (!(rem instanceof Array)) settings[k].unshift(rem);
        }
    });
    function insertCompo() {
        settings = _this.menus.popMenuValues(settings);
        var chosenName = settings.name;
        settings.name = validName(settings.name);
        if (!settings.name || _this.hasObject(settings.name, _this.getObjectName())) {
            notify("The name '" + chosenName + "' has been taken or is not suitable. Please choose other name.");
            return;
        }
        _this.menus.clearPopMenu();
        _this.saveAllPositions();
        lastSettings[obj.name] = settings;
        _this.insert(settings.name, obj.name, settings);
        _this.updateCode();
        _this.updateValueAndHistory();
        _this.redraw();
    }

    _this.menus.makePopMenu({
        title: 'Insert: ' + obj.name,
        content: settings,
        buttons: {
            Cancel: function () {
                _this.menus.clearPopMenu();
            },
            'Insert': insertCompo
        },
        info: _this.parseComments(obj)
    });
};

OperationsManager.prototype.cloneComponent = function (name) {
    var _this = this;
    _this.menus.clearPopMenu();
    if (!_this.hasAssemble()) {
        notify("Current object is not of type Assemble.");
        return;
    }
    var settings = {name: ""};
    _.extend(settings, _this.content.declarations[name].options);
    var objectConstructor = _this.content.declarations[name].object;
    var obj = this.servedDatabase.getByName(objectConstructor);
    settings.name = nextName(settings.name || obj.name);
    while (_this.hasObject(settings.name, _this.getObjectName())) {
        settings.name = nextName(settings.name);
    }
    var o = codeObject(obj.code, null, obj.name);
    _.map(o.getSettings(), function (v, k) {
        if (v instanceof Array) {
            var rem = settings[k];
            settings[k] = _.without(v, rem);
            settings[k].unshift(rem);
        }
    });
    //this function is exact. the same as in this.insertComponent
    function insertCompo() {
        settings = _this.menus.popMenuValues(settings);
        var chosenName = settings.name;
        settings.name = validName(settings.name);
        if (!settings.name || _this.hasObject(settings.name, _this.getObjectName())) {
            notify("The name '" + chosenName + "' has been taken or is not suitable. Please choose other name.");
            return;
        }
        _this.menus.clearPopMenu();
        _this.menus.clearContext();
        _this.saveAllPositions();
        lastSettings[obj.name] = settings;
        _this.insert(settings.name, obj.name, settings);
        _this.updateCode();
        _this.updateValueAndHistory();
        _this.redraw();
    }

    _this.menus.makePopMenu({
        title: 'Clone ' + name,
        content: settings,
        buttons: {
            Cancel: function () {
                _this.menus.clearPopMenu();
            },
            Insert: insertCompo
        },
        info: _this.parseComments(obj)
    });
};

OperationsManager.prototype.updateOnSceneComponent = function (key) {
    var _this = this;
    _this.menus.clearPopMenu();
    var settings = _.extend({name: ""}, _this.content.declarations[key].options);
    var objectConstructor = _this.content.declarations[key].object;
    var obj = this.servedDatabase.getByName(objectConstructor);
    var o = codeObject(obj.code, null, objectConstructor);
    _.map(o.getSettings(), function (v, k) {
        if (v instanceof Array) {
            var rem = settings[k];
            settings[k] = _.without(v, rem);
            settings[k].unshift(rem);
        }
    });
    var oldName = settings.name;

    function updateComponent() {
        var newSettings = _this.menus.popMenuValues(settings);
        var chosenName = newSettings.name;
        newSettings.name = validName(newSettings.name) || key.split("/").pop();
        if (!newSettings.name || (newSettings.name != oldName ) && (_this.hasObject(newSettings.name, _this.getObjectName()))) {
            notify("The name '" + chosenName + "' has been taken or is not suitable. Choose other name.");
            return;
        }
        _this.menus.clearPopMenu();
        _this.saveAllPositions();
        _this.updateValueAndHistory();
        _this.content.declarations[key].options = newSettings;
        _this.renameKey(key, newSettings.name);
        //_this.removeAllConnections(sets.name);
        _this.menus.clearContext();
        _this.updateCode();
        _this.redraw();
        _this.saveAllPositions();
        _this.updateValueAndHistory();
    }

    _this.menus.makePopMenu({
        title: 'Properties of ' + key + ' (' + objectConstructor + ')',
        content: settings,
        buttons: {
            Cancel: function () {
                _this.menus.clearPopMenu();
            },
            Copy: function () {
                _this.menus.copyMenuValues();
            },
            Paste: function () {
                _this.menus.pasteMenuValues();
            },
            Save: updateComponent
        },
        info: _this.parseComments(obj)
    });
};

OperationsManager.prototype.changeConnection = function (fixed, moved, type) {
    var _this = this;
    _this.menus.clearPopMenu();
    //the object by reference
    var connDef = _this.getConnectOperation(fixed, moved);
    var settings = _.clone(connDef.controllerOptions);
    type = type || settings.type;
    var defaults = Assemblino.actuators.getDefaults(type) || {};
    settings = _.defaults(settings, defaults);
    settings = _.pick(settings, 'name', 'type', _.keys(defaults));
    _.defaults(settings, {name: nextName('CONTROL')});
    while (this.hasObject(settings.name, this.getObjectName())) {
        settings.name = nextName(settings.name);
    }
    var types = _.intersection(fixed.options.accept, moved.options.accept, Assemblino.actuators.getConstraintKeys());
    types = _.without(types, type);
    settings.type = [type].concat(types.sort());
    var updateComponent = function () {
        settings = Assemblino.menus.popMenuValues(settings);
        var curName = fixed.controller.settings.options.name;
        var newName = settings.name;
        if (curName != newName && _this.object.getController(newName)) {
            notify('The controller name ' + newName + ' is taken. Please choose other one.');
            return;
        }
        fixed.controller.settings.options = settings;
        Assemblino.menus.clearPopMenu();
        connDef.controllerOptions = settings;
        _this.saveAllPositions();
        _this.updateValueAndHistory();
        _this.redraw();
    };
    var title = 'Change Connection: '
        + moved.parentPartKey() + ".[" + moved.getKey() + "] to "
        + fixed.parentPartKey() + ".[" + fixed.getKey() + "]";
    Assemblino.menus.makePopMenu({
        title: title,
        content: settings,
        buttons: {
            Cancel: function () {
                Assemblino.menus.clearPopMenu();
            },
            Save: updateComponent
        },
        onChange: {
            type: function (value) {
                //this timeout is here just to avoid destroying the drop box while on the middle of it's onChange event
                setTimeout(function () {
                    _this.changeConnection(fixed, moved, value);
                }, 0);
            }
        },
        info: Assemblino.actuators.getInfo(type)
    });
};

//get some methods from Assemble
_.extend(OperationsManager.prototype, _.pick(Assemble.prototype, [
    'codeName', 'contentToCode', 'contentAsCode', 'optionsCode',
    'declarationCode', 'physicCode', 'connectCode', 'connectStateCode',
    'removeConnectionsToOrFrom',
    'hasObject', 'renameKey', 'insert', 'makeKey',
    'appendConnectOperation', 'removeConnectOperation', 'getConnectOperation'
]));

