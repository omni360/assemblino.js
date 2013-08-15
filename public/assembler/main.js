'use strict';
var OBJECTS = {};

var Assemblino = {
    debugMode: true,
    objects: OBJECTS,
    menus: null,
    loaded: false,
    localDevelopment: false,
    toggleSymbol: function (show, message) {
        if (show) {
            $("#" + CANVAS_ID).css("background", "transparent");
        }
        $("#symbol")[show ? "show" : "hide"]();
        $("#wait").html(message || "");
    }
};

//alias
var Assembler = Assemblino;

function extendAssemblino() {
    _.extend(Assemblino, Arduino.prototype);

    Assemblino.setInfo = function (info) {
        Assemblino.menus.showInfo.call(Assemblino.menus, info);
    };

    /*
     * Run automated testes defined in a file in folder tests/ and based on tester.js
     * name : the name of the file without .js
     */
    Assemblino.runTests = function (name) {
        var uri = "tests/" + name + ".js";
        jQuery.ajax(uri, {
            type: 'GET',
            cache: false,
            success: function () {
                Assemblino.menus.showInfo('<span class="green">' + 'Testing:<br/>' + uri + "</span>");
            },
            error: function () {
                Assemblino.menus.showInfo('<span class="red">' + 'Failure loading:<br/>' + uri + "</span>");
            }
        });
        return "getting tests..."
    };

    Assemblino.get = function (idOrName, options) {
        var obj = this.database.get(idOrName) || this.database.getByName(idOrName);
        if (obj) {
            var cons = this.objects[obj.name];
            if (!cons) return undefined;
            return cons(options || {});
        } else {
            return undefined;
        }
    };
}

window.onload = function () {
    //get user data from server
    //STATIC_COMPONENTS is defined in components/_public.js
    Assemblino.toggleSymbol(true, "Assigning database components...");
    var database = new ServedDatabase(STATIC_COMPONENTS);
    Assemblino.database = database;
    Assemblino.toggleSymbol(true, "Requesting session information...");
    database.getSessionInfo(afterGettingSessionInfo);
    //callback to load objects to local database
    function afterGettingSessionInfo(info) {
        Assemblino.toggleSymbol(true, "Preparing local databases...");
        database.localDatabase = new LocalDatabase(info.user, function () {
            Assemblino.toggleSymbol(true, "Requesting component changes...");
            database.requestOnlyDiffs(afterLoadingObjects);
        });
    }

    //callback to finally create menus, start simulation, etc
    function afterLoadingObjects() {
        //code mirror, dat.gui
        Assemblino.toggleSymbol(true, "Building menus and initializing the simulator...");

        var menus = new Menu(database);
        Assemblino.menus = menus;
        //interface to physics simulation and canvas/webgl rendering
        var simulator = new PhysicsSimulator(database);
        Assemblino.simulator = simulator;
        menus.simulator = simulator;
        //code mirror, javascript editor
        var editor = menus.addCodeMirror();
        Assemblino.editor = editor;
        Assemblino.arduino = new Arduino(database.getInfo('boardPath'));
        Assemblino.arduino.enabled = database.getInfo("arduino");
        //initialize renderer, canvas, camera, start simulation
        simulator.init();
        //show menus
        menus.showGUI();
        menus.addSettingsControls(simulator);
        menus.addCodeResizer();
        menus.assignInfoClick();
        Assemblino.actuators = new Actuators();
        //manages objects interaction with user
        var manager = new OperationsManager(editor, database, menus, simulator, OBJECTS);
        Assemblino.manager = manager;
        menus.displayLoggedUser(manager.user);
        Connector.prototype.manager = manager;
        Connector.prototype.simulator = simulator;
        Assemblino.toggleSymbol(true, "Registering components...");
        database.registerAllComponents(OBJECTS, menus);
        Assemblino.loaded = true;
        extendAssemblino();
        manager.autoLoad();
    }
};
