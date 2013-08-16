'use strict';
var OBJECTS = {};

var Assembler = {
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
var Assemblino = Assembler;

function extendAssemblino() {
    _.extend(Assembler, Arduino.prototype);

    Assembler.setInfo = function (info) {
        Assembler.menus.showInfo.call(Assembler.menus, info);
    };

    /*
     * Run automated testes defined in a file in folder tests/ and based on tester.js
     * name : the name of the file without .js
     */
    Assembler.runTests = function (name) {
        var uri = "tests/" + name + ".js";
        jQuery.ajax(uri, {
            type: 'GET',
            cache: false,
            success: function () {
                Assembler.menus.showInfo('<span class="green">' + 'Testing:<br/>' + uri + "</span>");
            },
            error: function () {
                Assembler.menus.showInfo('<span class="red">' + 'Failure loading:<br/>' + uri + "</span>");
            }
        });
        return "getting tests..."
    };

    Assembler.get = function (idOrName, options) {
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
    Assembler.toggleSymbol(true, "Assigning database components...");
    var database = new ServedDatabase(STATIC_COMPONENTS);
    Assembler.database = database;
    Assembler.toggleSymbol(true, "Requesting session information...");
    database.getSessionInfo(afterGettingSessionInfo);
    //callback to load objects to local database
    function afterGettingSessionInfo(info) {
        Assembler.toggleSymbol(true, "Preparing local databases...");
        database.localDatabase = new LocalDatabase(info.user, function () {
            Assembler.toggleSymbol(true, "Requesting component changes...");
            database.requestOnlyDiffs(afterLoadingObjects);
        });
    }

    //callback to finally create menus, start simulation, etc
    function afterLoadingObjects() {
        //code mirror, dat.gui
        Assembler.toggleSymbol(true, "Building menus and initializing the simulator...");

        var menus = new Menu(database);
        Assembler.menus = menus;
        //interface to physics simulation and canvas/webgl rendering
        var simulator = new PhysicsSimulator(database);
        Assembler.simulator = simulator;
        menus.simulator = simulator;
        //code mirror, javascript editor
        var editor = menus.addCodeMirror();
        Assembler.editor = editor;
        Assembler.arduino = new Arduino(database.getInfo('boardPath'));
        Assembler.arduino.enabled = database.getInfo("arduino");
        //initialize renderer, canvas, camera, start simulation
        simulator.init();
        //show menus
        menus.showGUI();
        menus.addSettingsControls(simulator);
        menus.addCodeResizer();
        menus.assignInfoClick();
        Assembler.actuators = new Actuators();
        //manages objects interaction with user
        var manager = new OperationsManager(editor, database, menus, simulator, OBJECTS);
        Assembler.manager = manager;
        menus.displayLoggedUser(manager.user);
        Connector.prototype.manager = manager;
        Connector.prototype.simulator = simulator;
        Assembler.toggleSymbol(true, "Registering components...");
        database.registerAllComponents(OBJECTS, menus);
        Assembler.loaded = true;
        extendAssemblino();
        manager.autoLoad();
    }
};
