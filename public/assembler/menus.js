'use strict';

function FakeEditor() {
    this.value = "";
}
FakeEditor.prototype.setValue = function (value) {
    this.value = value;
};
FakeEditor.prototype.getValue = function () {
    return this.value;
};
FakeEditor.prototype.refresh = function () {
};

function Menu(database) {
    this.display = true;
    this.manager = null;
    this.database = database;
    this.simulator = null;
    this.updatableControls = {};
    this.$footInfo = $("#footinfo");
}

_.extend(Menu.prototype, {
    INTERACTION_FOLDER: null,
    CONTEXT_MENU: null,
    COMPONENTS_FOLDER: null,
    INSERT_FOLDER: null,
    FILE_FOLDER: null,
    SETTINGS_FOLDER: null,
    EDIT_FOLDER: null,
    POP_FOLDER: null,
    RENDER_FOLDER: null,
    CONTROLS_FOLDER: null
});

Menu.prototype.saveOption = function (key, value) {
    if (this.manager) {
        this.manager.saveOption(key, value)
    } else {
        this.database.saveInfo(key, value);
    }
};

Menu.prototype.getOption = function (key) {
    if (this.manager) {
        return this.manager.getOption(key);
    } else {
        return this.database.getInfo(key);
    }
};

Menu.prototype.updateOptions = function () {
    var _this = this;
    if (this.manager && this.manager.isLoaded()) {
        _.map(_this.manager.options, function (value, key) {
            _this.updatableControls[key] && _this.updatableControls[key].setValue(value);
        });
        _this.updatableControls['name'].setValue(this.manager.getObjectName());
        var width = _this.getOption('codeWrapperWidth');
        var height = _this.getOption('codeWrapperHeight');
        width = width > 90 ? 90 : width < 10 ? 10 : width;
        height = height > 90 ? 90 : height < 10 ? 10 : height;
        var $wrapper = $("#CodeWrapper");
        if (width) {
            $wrapper.css('width', width + "%");
        }
        if (height) {
            $wrapper.css('height', height + "%");
        }
    }
};

Menu.prototype.updateCameraControls = function () {
    if (this.getOption('cameraPosition')) {
        this.simulator.camera.position.copy(Vec3(this.getOption('cameraPosition')));
    }
    if (this.getOption('cameraTarget')) {
        this.simulator.trackBallControls.target.copy(Vec3(this.getOption('cameraTarget')));
    }
    this.simulator.cameraControls.update();
};

Menu.prototype.saveCameraControls = function () {
    this.saveOption('cameraPosition', vecToArray(this.simulator.camera.position));
    this.saveOption('cameraTarget', vecToArray(this.simulator.trackBallControls.target));
};

Menu.prototype.closeFolders = function () {
    [this.FILE_FOLDER, this.EDIT_FOLDER, this.SETTINGS_FOLDER].map(function (f) {
        f.close();
    });
};

Menu.prototype.toggleUserUXControls = function (show, mine) {
    var opera = show ? 'show' : 'hide';
    [this.EDIT_FOLDER, this.INTERACTION_FOLDER, this.SETTINGS_FOLDER].map(function (f) {
        $(f.domElement)[opera]();
    });
    var fileFolder = this.FILE_FOLDER;
    if (mine) {
        ['Delete', 'Save', 'Save As', 'Close', 'Reload', 'Download', 'Download All'].map(function (name) {
            fileFolder.toggleController(name, show, true);
        });
    } else {
        ['Delete', 'Save'].map(function (name) {
            fileFolder.toggleController(name, false, true);
        });
        ['Save As', 'Close', 'Reload', 'Download', 'Download All'].map(function (name) {
            fileFolder.toggleController(name, show, true);
        });
    }
    fileFolder = this.SETTINGS_FOLDER;
    if (mine) {
        ['Share'].map(function (name) {
            fileFolder.toggleController(name, show, true);
        });
    } else {
        ['Share'].map(function (name) {
            fileFolder.toggleController(name, false, true);
        });
    }
    this.INTERACTION_FOLDER.toggleController('Update from File', this.database.isDesktopFile(this.manager.getObjectName()), true);
    //this.EDIT_FOLDER.toggleController('Code Editor', !this.database.isDesktopFile(this.manager.getObjectName()), true);

};

Menu.prototype.showGUI = function () {
    if (!this.display) return;
    var _this = this;

    function onTitleClick(folder) {
        var name = folder.__textClosed;
        [_this.FILE_FOLDER, _this.EDIT_FOLDER, _this.SETTINGS_FOLDER].map(function (other) {
            if (other.__textOpen != name) {
                other.close();
                other.collapseTree();
            }
        });
        if (folder.closed) {
            folder.collapseTree();
        }
    }

    _this.INTERACTION_FOLDER = _this.INTERACTION_FOLDER || new dat.GUI({
        autoPlace: false,
        textOpen: "Interaction",
        textClosed: "Interaction",
        id: "interaction",
        onTitleClick: function () {
            _this.closeFolders();
            if (this.closed) {
                _this.INTERACTION_FOLDER.collapseTree(2);
            }
        }
    });
    _this.EDIT_FOLDER = _this.EDIT_FOLDER || new dat.GUI({
        autoPlace: false,
        textOpen: "Edit",
        textClosed: "Edit",
        onTitleClick: onTitleClick
    });
    _this.EDIT_FOLDER.close();
    _this.FILE_FOLDER = _this.FILE_FOLDER || new dat.GUI({
        autoPlace: false,
        textOpen: "File",
        textClosed: "File",
        onTitleClick: onTitleClick
    });
    _this.FILE_FOLDER.close();
    _this.SETTINGS_FOLDER = _this.SETTINGS_FOLDER || new dat.GUI({
        autoPlace: false,
        textOpen: "Settings",
        textClosed: "Settings",
        id: "settings",
        onTitleClick: onTitleClick
    });
    _this.SETTINGS_FOLDER.close();
    var customContainer = document.getElementById('menucontainer');
    [_this.FILE_FOLDER, _this.EDIT_FOLDER, _this.SETTINGS_FOLDER, _this.INTERACTION_FOLDER].map(function (folder) {
        customContainer.appendChild(folder.domElement);
    });
    var margin = (window.screen.availWidth - dat.__DEFAULT_WIDTH * 4);
    if (margin > 0) {
        $("#menucontainer > *").css("margin-right", 0);
    }
    this.showEditorFolder();
};

Menu.prototype.makePublic = function () {
    if (!Assembler.manager.object) {
        notify('Object is not ready to publish.');
        return;
    }
    if (!confirm('This will generate a link to share this object. \n\nContinue?')) return;
    var canvas = document.getElementById(CANVAS_ID);
    canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
    var ratio = canvas.width / canvas.height;
    var width = 512;
    var height = Math.round(width / ratio);
    var data = canvas.toDataURL();
    var $canvas = $("<canvas />", {
        id: 'temporaryCanvas'
    });
    $canvas.attr('width', width);
    $canvas.attr('height', height);
    $('body').append($canvas);
    $('body').append($("<img />", {
        id: 'temporaryImage',
        width: width,
        height: height,
        src: data
    }));
    var temporaryImage = document.getElementById('temporaryImage');
    var temporaryCanvas = document.getElementById('temporaryCanvas');
    var context = temporaryCanvas.getContext('2d');
    temporaryImage.onload = function () {
        context.drawImage(temporaryImage, 0, 0, width, height);
        data = temporaryCanvas.toDataURL();
        $(temporaryImage).remove();
        $(temporaryCanvas).remove();
        var dependantsList = _.compact(_.map(Assembler.database.searchDependants(Assembler.manager.getObjectName()), function(did){
            var obj = Assembler.database.get(did);
            if (!Assembler.database.userIsPublic(obj.username)){
                return undefined;
            } else {
                return obj.username + "" + obj.id;
            }
        }));
        var dependencyList = _.compact(_.map(Assembler.manager.getOption('dependencies'), function(dname){
            var obj = Assembler.database.getByName(dname);
            if (!Assembler.database.userIsPublic(obj.username)){
                return undefined;
            } else {
                return obj.username + "" + obj.id;
            }
        }));
        var dependencies = _.compact(_.map(Assembler.manager.getOption('dependencies'), function(dname){
            var obj = Assembler.database.getByName(dname);
            if (Assembler.database.userIsPublic(obj.username)){
                return undefined;
            } else {
                return obj.id;
            }
        }));
        dependencies.push(Assembler.manager.getObjectId());
        var path = (Assembler.manager.owner || "") + "/" + Assembler.manager.getOption('folder') + "/" + Assembler.manager.getObjectName();
        while(path.match(/\/\//igm)){
            path = path.replace(/\/\//igm, '/');
        }
        Assembler.database.makePublic({
            picture: data,
            time: formatedTime(),
            id: Assembler.manager.getObjectId(),
            dependencies: dependencies,
            dependantsList: dependantsList,
            dependencyList: dependencyList,
            name: Assembler.manager.getObjectName(),
            parameters: Assembler.manager.object.getOptions(),
            path: path,
            text: Assembler.menus.cleanComment(Assembler.manager.parseComments(Assembler.manager.getObjectId()))
        }, function (s) {
            var status = JSON.parse(s);
            if (status.status != 'ok') {
                notify('Failed to make component public. \nVerify: \n - Are you logged in?');
            } else {
                Assembler.menus.updatableControls.link.setValue(status.link);
                Assembler.menus.updatableControls.embed.setValue(status.embed);
                Assembler.menus.saveOption('link', status.link);
                Assembler.menus.saveOption('embed', status.embed);
                Assembler.manager.saveComponent();
                notify(status.link);
            }
        });
    };
};

Menu.prototype.showEditorFolder = function () {
    if (!this.display) return;
    var _this = this;
    var newFolder = _this.FILE_FOLDER.addFolder('New');
    ['Assemble', 'System', 'Part'].map(function (objectType) {
        var o = {};
        o[objectType] = function () {
            _this.manager.newComponent(objectType);
        };
        newFolder.add(o, objectType);
    });
    if (!_this.COMPONENTS_FOLDER) {
        _this.COMPONENTS_FOLDER = _this.FILE_FOLDER.addFolder('Open');
    }
    if (!_this.INSERT_FOLDER) {
        _this.INSERT_FOLDER = _this.EDIT_FOLDER.addFolder('Insert');
    }
    if (isChrome() && window.File && window.FileReader && window.FileList && window.Blob) {
        var transferFolder = _this.FILE_FOLDER.addFolder('Transfer');
        if (Assembler.database.getUsername()) {
            transferFolder.add({'Upload': function () {
                _this.upload();
            }}, 'Upload');
        }
        transferFolder.add({'Download': function () {
            _this.download();
        }}, 'Download');
        if (false && Assembler.database.getUsername()) {
            transferFolder.add({'Download All': function () {
                _this.downloadAll();
            }}, 'Download All');
        }
    }
    var ec = {}; //editor controls
    ec.save = _this.FILE_FOLDER.add({'Save': function () {
        _this.saveCameraControls();
        _this.manager.saveComponent();
        _this.flashStatus('Save');
    }}, 'Save');
    ec['Save As'] = _this.FILE_FOLDER.add({'Save As': function () {
        _this.manager.saveAsComponent();
        _this.flashStatus('Save As');
    }}, 'Save As');
    ec.reload = _this.FILE_FOLDER.add({'Reload': function () {
        _this.manager.reload();
        _this.flashStatus('Reload');
    }}, 'Reload');
    ec.close = _this.FILE_FOLDER.add({'Close': function () {
        _this.manager.closeComponent(false);
        _this.flashStatus('Close');
    }}, 'Close');
    ec.delete = _this.FILE_FOLDER.add({'Delete': function () {
        _this.manager.deleteComponent();
        _this.flashStatus('Delete');
    }}, 'Delete');
    //editing
    ec.redraw = _this.EDIT_FOLDER.add({'Redraw': function () {
        _this.manager.updateCode();
        _this.manager.redraw();
        _this.flashStatus('Redraw');
    }}, 'Redraw');
    ec.undo = _this.EDIT_FOLDER.add({'Undo': function () {
        _this.manager.undo();
        _this.flashStatus('Undo');
    }}, 'Undo');
    ec.redo = _this.EDIT_FOLDER.add({'Redo': function () {
        _this.manager.redo();
        _this.flashStatus('Redo');
    }}, 'Redo');
    ec.toggle = _this.EDIT_FOLDER.add({'Code Editor': !!_this.getOption('codeEditor')}, 'Code Editor');
    ec.toggle.onChange(
        function (value) {
            _this.saveOption('codeEditor', value);
            //_this.flashStatus('Code Editor');
            setTimeout(function () {
                _this.toggleCodeMirror(value);
            }, _this.simulator.renderInterval);
        }
    );

    //add buttons to editor
    var container = $("#editorcontrols");
    ["save", "redraw", "undo", "redo", "toggle"].map(function (command) {
        var gui = ec[command];
        var button = $("<span />");
        button.addClass("editorbutton");
        button.html(command.charAt(0).toUpperCase() + command.substr(1));
        button.on("click", function () {
            if (gui.fire) {
                gui.fire();
            } else { //toggle
                gui.setValue(!gui.getValue());
            }
        });
        container.append(button);
    });
    ec.codeEditor = ec.toggle;
    _.extend(_this.updatableControls, _.pick(ec, ['codeEditor', 'folder']));
};

Menu.prototype.orderComponentsByFolder = function (objects) {
    var relations = {};
    var order = [];
    _.map(objects, function (obj, id) {
        var settings = JSON.parse(obj.settings || "{}");
        var options = settings.options;
        var owner = settings && settings.owner;
        var folder = (owner || "") + "/" + (options && options.folder || "/") + obj.name;
        order.push(folder);
        relations[folder] = id;
    });
    order.sort();
    for (var i = 0; i < order.length; i++) {
        order[i] = objects[relations[order[i]]];
    }
    return order;
};

Menu.prototype.addComponentToGui = function (obj) {
    if (!this.display) return;
    var _this = this;
    var guiObj = {};
    var id = obj.id;
    var settings = JSON.parse(obj.settings || "{}");
    var options = settings.options;
    if (!options) return;
    var owner = settings && settings.owner;
    var compFolderChild = this.COMPONENTS_FOLDER;
    var insertFolderChild = this.INSERT_FOLDER;
    var folders = (options && options.folder || "").split(/[\/\\,]/);
    owner && folders.unshift(owner);
    while (folders.length) {
        var fname = folders.shift();
        fname && ($.trim(fname));
        if (!fname) continue;
        compFolderChild = compFolderChild.getFolder(fname) || compFolderChild.addFolder(fname);
        insertFolderChild = insertFolderChild.getFolder(fname) || insertFolderChild.addFolder(fname);
    }
    guiObj[obj.name] = function () {
        var ob = _this.database.get(id);
        //location.href = "assemblino.html?name=" + obj.name;
        _this.manager.editComponent(ob);
    };
    compFolderChild.getController(obj.name) || compFolderChild.add(guiObj, obj.name);
    guiObj = {};
    guiObj[obj.name] = function () {
        var ob = _this.database.get(id);
        _this.manager.insertComponentAsChild(ob);
    };
    insertFolderChild.getController(obj.name) || insertFolderChild.add(guiObj, obj.name);
};

Menu.prototype.addCodeMirror = function (options) {
    if (!this.display) {
        return new FakeEditor();
    }
    var width = this.getOption('codeWrapperWidth');
    var height = this.getOption('codeWrapperHeight');
    width = width > 90 ? 90 : width < 10 ? 10 : width;
    height = height > 90 ? 90 : height < 10 ? 10 : height;
    var $wrapper = $("#CodeWrapper");
    if (width) {
        $wrapper.css('width', width + "%");
    }
    if (height) {
        $wrapper.css('height', height + "%");
    }
    $("<div />", {
        id: "editorcontrols"
    }).appendTo($wrapper);
    var editor = new CodeMirror(document.getElementById('CodeWrapper'), {
        value: options && options.code || "",
        mode: "javascript",
        lineNumbers: true,
        matchBrackets: true,
        undoDepth: 100,
        extraKeys: {"Enter": "newlineAndIndentContinueComment"},
        theme: "lesser-dark"
    });
    this.editor = editor;
    return editor;
};

Menu.prototype.addCodeResizer = function () {
    if (!this.display) return;
    var _this = this;

    function resize(event, ui) {
        ui.element.css('top', 'auto');
        _this.editor.refresh();
    }

    function updateSettings(event, ui) {
        var width = ui.size.width;
        var height = ui.size.height;
        width = Math.round(100.0 * width / window.innerWidth);
        height = Math.round(100.0 * height / window.innerHeight);
        _this.saveOption('codeWrapperWidth', width);
        _this.saveOption('codeWrapperHeight', height);
    }

    $(function () {
        $("#CodeWrapper").resizable({
            handles: 'ne, n, e',
            resize: resize,
            stop: updateSettings
        });
    });
};

Menu.prototype.toggleCodeMirror = function (show) {
    if (!this.display) return;
    var _this = this;
    var $codeWrapper = $("#CodeWrapper");
    var current = $codeWrapper.css('display');
    if (show !== undefined && show) {
        $codeWrapper.show();
        Assembler.simulator.toggleKeyboardEvents(false);
    } else if (show !== undefined && !show) {
        $codeWrapper.hide();
        Assembler.simulator.toggleKeyboardEvents(true);
    } else if (current == 'none' || show) {
        $codeWrapper.show();
        Assembler.simulator.toggleKeyboardEvents(false);
    } else {
        $codeWrapper.hide();
        Assembler.simulator.toggleKeyboardEvents(true);
    }
    setTimeout(function () {
        _this.editor.refresh();
    }, 0);
};

Menu.prototype.flashStatus = function (text, time) {
    time || (time = 500);
    var status = $("#status");
    status.html(text);
    status.show();
    status.fadeOut(time);
};

Menu.prototype.displayCurrentObjectName = function (name, owner, folder) {
    document.title = name || "Assemblino";
    var path = "/" + (owner || "" ) + "/" + (folder || "") + "/ ";
    path = path.replace(/\/\/+/g, '/');
    $("#editing").html(path + "<span id='editingname'>" + name + "</span>");
};

Menu.prototype.displayLoggedUser = function (user) {
    var $user = $("#assembleruser");
    var $logout = $("#assemblerlogout");
    if (user) {
        $logout.html("<a class='gray' href='/logout.html'>Log out</a>");
        $user.html(user);
    } else {
        $logout.html("<a class='white' href='/login.html'>Log in</a>");
        $user.html("");
    }
};

Menu.prototype.assignInfoClick = function () {
    var _this = this;
    _this.$footInfo.on('click', function () {
        _this.$footInfo.hide();
    });
};

Menu.prototype.cleanComment = function (info) {
    //start at the position marked with the first /*
    info = info.substr(info.search(/[^\/\n\r\t\s\*]/m));
    //clear all the last */
    info = info.replace(/\*\//gm, '');
    info = info.replace(/\*/gm, ' ');
    //replace double newlines with <br>
    //info = info.replace(/[\n\r]\s*\*+/gm, '<br />');
    info = info.replace(/[\r]/gm, '\n');
    info = info.replace(/\n *\n/gm, '<br /><br />');
    info = info.replace(/\n/gm, ' ');
    return info;
};

Menu.prototype.updateInfo = function (info) {
    this.$footInfo.html(this.cleanComment(info));
};

Menu.prototype.showInfo = function (info) {
    if (!info) {
        this.clearInfo();
        return;
    }
    this.$footInfo.html(this.cleanComment(info));
    this.$footInfo.show();
};

Menu.prototype.toggleInfo = function (show) {
    if (this.$footInfo.html()) {
    } else {
        this.showInfo("No information assigned.");
    }
    if (show) {
        this.$footInfo.show();
    } else if (this.$footInfo.is(':visible')) {
        this.$footInfo.hide();
    } else {
        this.$footInfo.show();
    }
};

Menu.prototype.hideInfo = function () {
    this.$footInfo.hide();
};

Menu.prototype.clearInfo = function () {
    this.$footInfo.html("");
    this.$footInfo.hide();
};

Menu.prototype.clearPopMenu = function () {
    if (!this.POP_FOLDER) return;
    this.POP_FOLDER.clear();
    $('#popmenu').hide();
    $('#popinfo').text("");
};

Menu.prototype.makePopMenu = function (options) {
    var container = document.getElementById('popmenu');
    var _this = this;
    if (!this.POP_FOLDER) {
        this.POP_FOLDER = new dat.GUI({
            autoPlace: false,
            textOpen: "X",
            textClosed: "X",
            onTitleClick: function () {
                setTimeout(function () {
                    _this.clearPopMenu();
                }, 0);
            },
            id: "popgui"
        });
        container.appendChild(this.POP_FOLDER.domElement);
        $(container).append($('<span />', {
            id: 'popinfo'
        }));
    }
    _this.closeFolders();
    _this.POP_FOLDER.open();
    $('#poptitle').html(options.title || "");
    _.keys(options.content).map(
        function (caption) {
            if (options.content[caption] === undefined) return;
            //console.log(caption, options.content[caption]);

            var parameterType = undefined;
            var controller;
            if (caption.match(/color/i)) {
                parameterType = "color";
                var hex = ("000000" + options.content[caption].toString(16));
                hex = hex.substr(hex.length - 6);
                options.content[caption] = "#" + hex;
                controller = _this.POP_FOLDER.addColor(options.content, caption);
            } else if (caption == 'units') {
                controller = _this.POP_FOLDER.add(options.content, caption, ['cm', 'mm', 'in']);
            } else if (caption.match(/opacity/i) || caption.match(/friction/i) || caption.match(/restitution/i)) {
                controller = _this.POP_FOLDER.add(options.content, caption, 0.0, 1.0, 0.01);
            } else if (options.content[caption] instanceof Array) {
                var list = _.without(options.content[caption], undefined);
                var value = list[0];
                list = _.unique(list);
                options.content[caption] = value;
                controller = _this.POP_FOLDER.add(options.content, caption, list);
            } else if (caption.match(/enable/i)) {
                options.content[caption] = !!options.content[caption];
                controller = _this.POP_FOLDER.add(options.content, caption);
            } else if (caption.match(/radius/i) || caption.match(/width/i) || caption.match(/length/i) || caption.match(/interval/i)
                || caption.match(/margin/i) || caption.match(/gap/i) || caption.match(/mass/i) || caption.match(/frequency/i) || caption.match(/period/i)) {
                if (options.content[caption] < 0) {
                    options.content[caption] = 0;
                }
                controller = _this.POP_FOLDER.add(options.content, caption);
            } else {
                controller = _this.POP_FOLDER.add(options.content, caption);
            }
            if (controller) {
                controller['parameterType'] = parameterType;
                //listeners
                if (options.onChange && options.onChange[caption]) {
                    controller.onChange(options.onChange[caption]);
                }
            }
        }
    );
    _.keys(options.buttons).map(
        function (caption) {
            _this.POP_FOLDER.add(options.buttons, caption);
        }
    );
    if (options.info) {
        $('#popinfo').html(this.cleanComment(options.info));
    }
    $(container).show();
};


Menu.prototype.popMenuValues = function (settings) {
    if (!this.POP_FOLDER) {
        return {};
    }
    var _this = this;
    _.keys(settings).map(function (key) {
        var controller = _this.POP_FOLDER.getController(key);
        if (!controller) return;
        if (controller.parameterType == 'color') {
            var val = controller.getValue();
            if (isNaN(val)) {
                settings[key] = eval(val.replace("#", "0x"));
            } else {
                settings[key] = val;
            }
        } else {
            settings[key] = controller.getValue();
        }
        //make some validations
        if (key.match(/radius/i) || key.match(/width/i) || key.match(/length/i)
            || key.match(/margin/i) || key.match(/gap/i) || key.match(/mass/i)) {
            if (settings[key] < 0) {
                settings[key] = 0;
            }
        }
    });
    return settings;
};

Menu.prototype.copyMenuValues = function () {
    if (!this.POP_FOLDER) {
        return {};
    }
    var _this = this;
    var copied = {};
    _this.POP_FOLDER.__controllers.map(function (controller) {
        if (!controller || !controller.property) return;
        var val = controller.getValue();
        if (typeof val != 'function') {
            copied[controller.property] = val;
        }
    });
    _this.flashStatus('Copy');
    return this.__copiedPopMenuValues = copied;
};

Menu.prototype.pasteMenuValues = function () {
    if (!this.POP_FOLDER) {
        return;
    }
    var _this = this;
    _this.POP_FOLDER.__controllers.map(function (controller) {
        if (controller.property !== 'name' && typeof controller.getValue() != 'function' && _this.__copiedPopMenuValues[controller.property] !== undefined) {
            controller.setValue(_this.__copiedPopMenuValues[controller.property]);
        }
    });
    _this.flashStatus('Paste');
};

Menu.prototype.showConnectorGUI = function (connector, type, clear) {
    if (!this.display) return;
    var _this = this;
    if (clear) {
        _this.clearContext();
    }
    _this.CONTEXT_MENU.open();
    var thisFolder;
    var index = connector.getKey();
    if (connector === connector.parentPart.centerConnector) {
        _this.CONTEXT_MENU.removeFolder(connector.parentPartID());
        thisFolder = _this.CONTEXT_MENU.addFolder(connector.parentPartID());
    } else {
        _this.CONTEXT_MENU.removeFolder(connector.parentPartID() + " . [ " + index + " ]");
        thisFolder = _this.CONTEXT_MENU.addFolder(connector.parentPartID() + " . [ " + index + " ]");
    }
    var rootParent = connector.parentPartID();
    var hasParent = connector.parentPart.hasParent();
    if (hasParent) {
        rootParent = connector.parentPart.rootParentName();
    }
    if (connector.parentPart.hasParent()) {
        name = connector.parentPart.rootParentName();
    }
    var isConnected = connector.parentPart.isConnected();
    thisFolder.open();
    var obj = {};
    if (_this.manager.hasAssemble()) {

        if (connector.isRootConnection() && type != 'target') {
            var key0 = 'Break Connection';
            obj[key0] = function () {
                if (confirm(key0 + ' ?')) {
                    _this.flashStatus(key0);
                    connector.breakConnection();
                    _this.clearContext();
                    _this.manager.updateValueAndHistory();
                }
            };
            thisFolder.add(obj, key0);

            var keyCC = 'Change Connection';
            obj[keyCC] = function () {
                _this.flashStatus(keyCC);
                var fixed = connector;
                var moved = connector.pairConnector;
                if (!fixed.isFixed) {
                    moved = connector;
                    fixed = connector.pairConnector;
                }
                _this.manager.changeConnection(fixed, moved);
                _this.clearContext();
            };
            thisFolder.add(obj, keyCC);
        }

        var name = rootParent;
        var key1 = 'Properties' + (hasParent ? ' of ' + rootParent : ''); // + name;
        obj[key1] = function () {
            _this.manager.updateOnSceneComponent(name);
        };
        thisFolder.add(obj, key1);

        var nameClone = rootParent;
        var keyClone = 'Clone' + (hasParent ? ' ' + rootParent : ''); // + name;
        obj[keyClone] = function () {
            _this.manager.cloneComponent(nameClone);
        };
        thisFolder.add(obj, keyClone);

    }
    if (type != 'target') {
        var rotate = function (axis) {
            return function () {
                _this.flashStatus('Rotate ' + axis);
                var scene = sceneOf(_this.simulator);
                scene.updateMatrixWorld(true);
                var backup = new THREE.Matrix4();
                backup.copyPosition(connector.axisHelper.matrixWorld);
                var selfAxisTransform = new THREE.Matrix4();
                selfAxisTransform.getInverse(backup);
                var rotation = new THREE.Matrix4();
                rotation['makeRotation' + axis](Math.PI / 4);
                var objects = connector.networkMeshes();
                for (var i = 0; i < objects.length; i++) {
                    var object = objects[i];
                    //set dirty
                    object.__dirtyPosition = true;
                    object.__dirtyRotation = true;
                    object.setLinearVelocity(Vec3());
                    object.setAngularVelocity(Vec3());
                    //move to origin
                    object.applyMatrix(selfAxisTransform);
                    //rotate
                    object.applyMatrix(rotation);
                    //move to where it was
                    object.applyMatrix(backup);
                }
                scene.updateMatrixWorld(true);
            };
        };

        ['X', 'Y', 'Z'].map(function (axis) {
            obj['Rotate ' + axis] = rotate(axis);
            thisFolder.add(obj, 'Rotate ' + axis);
        });
    }
    if (_this.manager.hasAssemble()) {
        if (isConnected) {
            //before displaying this check if the parent is connected
            var key3 = 'Isolate';
            obj[key3] = function () {
                if (confirm(key3 + '?')) {
                    _this.flashStatus(key3);
                    var part = connector.parentPart;
                    for (var j = 0; j < part.connectors.length; j++) {
                        part.connectors[j].isRootConnection() && part.connectors[j].breakConnection();
                    }
                    _this.clearContext();
                    _this.manager.updateValueAndHistory();
                }
            };
            thisFolder.add(obj, key3);
        }
        var key2 = 'Remove' + (hasParent ? ' ' + rootParent : '');
        obj[key2] = function () {
            if (confirm(key2 + '?')) {
                _this.flashStatus(key2);
                connector.removeParentFromScene(); //history and value are saved implicitly
                _this.clearContext();
            }
        };
        thisFolder.add(obj, key2);
    }
    if (_this.manager.hasAssemble() && type != 'target') {
        if (isConnected) {
            //remove all interconnected roots
            var key4 = 'Remove Network';
            obj[key4] = function () {
                if (confirm(key4 + '?')) {
                    _this.flashStatus(key4);
                    connector.removeNetworkFromScene(); //history and value are saved implicitly
                    _this.clearContext();
                }
            };
            thisFolder.add(obj, key4);

            var key5 = 'Dismantle Network';
            obj[key5] = function () {
                if (confirm(key5 + '?')) {
                    _this.flashStatus(key5);
                    var net = connector.networkParts();
                    for (var i = 0; i < net.length; i++) {
                        var part = net[i];
                        for (var j = 0; j < part.connectors.length; j++) {
                            part.connectors[j].isRootConnection() && part.connectors[j].breakConnection();
                        }
                    }
                    _this.clearContext();
                    _this.manager.updateValueAndHistory();
                }
            };
            thisFolder.add(obj, key5);
        }
    }
    if (type == 'single' && connector.isConnected) {
        if (connector.pairConnector.parentPart.rootParentName() != rootParent) {
            connector.pairConnector.showGUI('target', false);
        }
    }
};

Menu.prototype.addSettingsControls = function (sim) {
    if (!this.display) return;
    var _this = this;
    var ec = {};
    ec.showInfo = _this.SETTINGS_FOLDER.add({'Toggle Info': function () {
        _this.toggleInfo();
        _this.flashStatus('Toggling Info');
    }}, 'Toggle Info');
    var organ = _this.SETTINGS_FOLDER.addFolder('Organization');
    ec.folder = organ.add({'Folder': _this.getOption('folder')}, 'Folder');
    ec.folder.onFinishChange(
        function (value) {
            _this.saveOption('folder', value);
            _this.flashStatus('Folder: ' + value);
        }
    );
    ec.name = organ.add({'Name': "?"}, 'Name');
    ec.name.onFinishChange(
        function (value) {
            if (value !== _this.manager.getObjectName()) {
                Assembler.database.rename(_this.manager.getObjectName(), value);
            }
        }
    );
    if (Assembler.database.getUsername() && isChrome() && !DESKTOP_OPTIONS.enabled) {
        organ.add({'Share': function () {
            _this.makePublic();
        }}, 'Share');
        ec.link = organ.add({'Link': ""}, 'Link');
        ec.embed = organ.add({'Embed': ""}, 'Embed');
    }
    _this.addArduinoGUI();
    this.RENDER_FOLDER = this.RENDER_FOLDER || this.SETTINGS_FOLDER.addFolder('Simulation');
    var scenarioFolder = this.SETTINGS_FOLDER.addFolder('World');
    if (DESKTOP_OPTIONS.enabled) {
        ec.reloadDesk = this.INTERACTION_FOLDER.add({'Update from File': function () {
            window[DESKTOP_OPTIONS.globalName].update();
        }}, 'Update from File');
    }
    ec.pause = this.INTERACTION_FOLDER.add({Pause: false}, 'Pause');
    ec.pause.onChange(
        function (value) {
            _this.saveOption('pause', value);
            sim.pause(value);
        }
    );
    ec.autoStart = _this.INTERACTION_FOLDER.add({'Run Program': !!_this.getOption('autoStart')}, 'Run Program');
    ec.autoStart.onChange(
        function (value) {
            value = !!value;
            _this.simulator.runProgram = value;
            _this.saveOption('autoStart', value);
            _this.flashStatus(value ? 'Run Program' : 'Stop Program');
        }
    );
    ec.softHandling = this.INTERACTION_FOLDER.add({'Soft Handling': !!sim.softHandling}, 'Soft Handling');
    ec.softHandling.onChange(
        function (value) {
            sim.softHandling = !!value;
            _this.saveOption('softHandling', sim.softHandling);
        }
    );
    ec.showConnectors = this.INTERACTION_FOLDER.add({'Connection Mode': true}, 'Connection Mode');
    ec.showConnectors.onChange(
        function (value) {
            _this.saveOption('showConnectors', value);
            sim.showConnectors = value;
            sim.connectors.map(function (con) {
                if (con.isTouchable) {
                    con.visible(value);
                }
            });
        });
    this.CONTEXT_MENU = this.INTERACTION_FOLDER.addFolder('Context');
    ec.scale = this.RENDER_FOLDER.add({Scale: _this.getOption("scale") || 'centimeter'}, 'Scale', _.keys(_this.simulator._scales));
    ec.scale.onChange(function (value) {
        _this.simulator.setScale(value);
        _this.saveOption('scale', value);
    });
    ec.simulationQuality = this.RENDER_FOLDER.add({'Quality': Math.round(sim.simulationQuality)}, 'Quality', 1, 60, 1);
    ec.simulationQuality.onChange(
        function (value) {
            sim.simulationQuality = Math.round(value);
            _this.saveOption('simulationQuality', sim.simulationQuality);
            sim.fixedTimeStep = 1.0 / (sim.simulationQuality * 60.0);
            sceneOf(sim).setFixedTimeStep(sim.fixedTimeStep);
        });
    ec.connectorRadius = scenarioFolder.add({'Connector Radius': _this.getOption('connectorRadius') || 0.5}, 'Connector Radius', 0.1, 3, 0.1);
    ec.connectorRadius.onChange(
        function (value) {
            value || (value = 0.5);
            sim.connectorRadius = value;
            _this.saveOption('connectorRadius', value);
            sim.rescaleConnectors();
        });
    ec.showAxis = scenarioFolder.add({'Show Axis': _this.simulator.showAxis}, 'Show Axis');
    ec.showAxis.onChange(
        function (value) {
            _this.saveOption('showAxis', value);
            sim.showAxis = value;
            _this.simulator.toggleAxis(value);
        });
    /*
     ec.autoLoad = scenarioFolder.add({'Auto Load': !!_this.getOption('autoLoad')}, 'Auto Load');
     ec.autoLoad.onChange(
     function (value) {
     _this.saveOption('autoLoad', value);
     _this.flashStatus('Auto Load');
     }
     );
     */
    ec.scenario = scenarioFolder.add({Background: _this.getOption("scenario") || SCENARIO}, 'Background', _.sortBy(_.keys(SCENARIOS), _.identity));
    ec.scenario.onChange(function (value) {
        _this.saveOption('scenario', value);
        if (_this.simulator.reloadScenario(value)) {
            //_this.manager.reload();
        }
        $(this.domElement).children("select").blur();
    });
    ec.simulationInterval = this.RENDER_FOLDER.add({'Simulation Time': sim.simulationInterval}, 'Simulation Time', 10, 100, 1);
    ec.simulationInterval.onChange(
        function (value) {
            sim.simulationInterval = Math.round(value);
        });
    ec.simulationInterval.onFinishChange(
        function (value) {
            _this.saveOption('simulationInterval', Math.round(value));
        });
    ec.renderInterval = this.RENDER_FOLDER.add({'Render Time': sim.renderInterval}, 'Render Time', 30, 500, 1);
    ec.renderInterval.onChange(
        function (value) {
            sim.renderInterval = Math.round(value);
        });
    ec.renderInterval.onFinishChange(
        function (value) {
            _this.saveOption('renderInterval', Math.round(value));
        });
    _.extend(_this.updatableControls, ec);
};

Menu.prototype.clearContext = function () {
    if (!this.display) return;
    this.CONTEXT_MENU.clear();
};

Menu.prototype.clearConstraintsGUI = function () {
    if (!this.display) return;
    if (this.CONTROLS_FOLDER) {
        this.CONTROLS_FOLDER.clear();
    }
};

Menu.prototype.addActuatorGUI = function (actuator, fun) {
    if (!this.display) return;
    if (!fun) return;
    if (!this.CONTROLS_FOLDER) {
        this.CONTROLS_FOLDER = this.INTERACTION_FOLDER.addFolder('Controllers');
        this.CONTROLS_FOLDER.open();
    }
    var controller = actuator.controller;
    var def = controller.settings;
    var folderName = def.name;
    if (controller.settings.objecta.part.hasParent()) {
        var path = controller.settings.objecta.part.getPath().slice();
        path.pop();
        folderName += " in " + path.join('/ ');
    }
    var folder = this.CONTROLS_FOLDER.addFolder(folderName);
    controller.guiFolderName = folderName;
    fun.call(actuator, controller, folder);
};

Menu.prototype.removeControllerGUI = function (controller) {
    if (!this.display) return;
    this.CONTROLS_FOLDER && this.CONTROLS_FOLDER.removeFolder(controller.guiFolderName);
};

Menu.prototype.removeFromComponentsFolder = function (name) {
    if (!this.display) return;
    this.COMPONENTS_FOLDER.removeController(name, true);
    this.INSERT_FOLDER.removeController(name, true);
};

Menu.prototype.toggleInteraction = function (obj) {
    var type = (obj && obj.objectType) || 'none';
    type = type.toUpperCase();
    var hide = {
        PART: ['INSERT_FOLDER', 'CONTROLS_FOLDER'],
        SYSTEM: ['INSERT_FOLDER'],
        ASSEMBLE: [],
        NONE: ['INSERT_FOLDER', 'CONTROLS_FOLDER']
    }[type];
    var show = {
        PART: [],
        SYSTEM: ['CONTROLS_FOLDER'],
        ASSEMBLE: ['INSERT_FOLDER', 'CONTROLS_FOLDER'],
        NONE: []
    }[type];
    var _this = this;
    show.map(function (folder) {
        _this[folder] && $(_this[folder].domElement).show();
    });
    hide.map(function (folder) {
        _this[folder] && $(_this[folder].domElement).hide();
    });
};

Menu.prototype.addArduinoGUI = function () {
    if (!Assembler.arduino || !Assembler.arduino.enabled) return;
    var arduino = Assembler.arduino;
    if (!this.display) return;
    arduino.folder = this.folder || this.SETTINGS_FOLDER.addFolder("Arduino");
    arduino.folder.add({Start: function () {
        arduino.init.call(arduino)
    }}, 'Start');
    arduino.folder.add({Path: arduino.boardPath}, 'Path').onChange(
        function (value) {
            arduino.boardPath = value;
            Assembler.database.saveInfo('boardPath', value);
        }
    );
};

/**
 * download current object and dependencies
 */
Menu.prototype.download = function () {
    var _this = this;
    var objName = _this.manager.getObjectName();
    var components = {};
    var key = this.database.fileKey;
    components[key] = objName;
    components[objName] = _this.database.getByName(objName);
    _.map(TRACKER.dependencies, function (name) {
        components[name] = _this.database.getByName(name);
    });
    var a = document.createElement('a');
    var blob = new Blob([JSON.stringify(components)], {type: 'application\/octet-stream'});
    a.href = (window.URL || window.webkitURL).createObjectURL(blob);
    a.download = objName + '.json';
    a.click();
    $(a).remove();
};

Menu.prototype.downloadAll = function () {
    var _this = this;
    var components = {};
    var objName = undefined;
    _.map(_this.database.objects, function (obj, id) {
        objName || (objName = obj.name);
        components[obj.name] = obj;
    });
    var key = this.database.fileKey;
    components[key] = objName;
    var a = document.createElement('a');
    var blob = new Blob([JSON.stringify(components)], {type: 'application\/octet-stream'});
    a.href = (window.URL || window.webkitURL).createObjectURL(blob);
    a.download = 'Assemblino-All.json';
    a.click();
    $(a).remove();
};

/**
 * used to process file uploads
 * @param evt
 */
Menu.prototype.handleFileSelect = function (evt) {
    try {
        var _this = Assembler.menus;
        var key = _this.database.fileKey;
        var files = evt.target.files; // FileList object
        for (var i = 0, f; f = files[i]; i++) {
            var reader = new FileReader();
            reader.onload = function (e) {
                var components = JSON.parse(this.result);
                var name = components[key];
                if (!name) throw null;
                _.map(components, function (obj, compName) {
                    if (compName === key) return;
                    var cur = _this.database.getByName(obj.name);
                    if (!cur) {
                        if (confirm(compName + " is not in the database. Save it?")) {
                            var sets = JSON.parse(obj.settings);
                            sets.owner = _this.database.getUsername() || "";
                            sets.options.autoStart = false;
                            sets.options.codeEditor = true;
                            sets.options.folder = "";
                            obj.settings = JSON.stringify(sets);
                            obj = _this.database.insertComponent(compName, obj.code, obj.settings, null, obj.last_change);
                            _this.addComponentToGui(obj);
                            _this.database.defineObject(obj.name, Assembler.objects);
                        }
                    } else if (obj.last_change != cur.last_change) {
                        if (confirm(compName + " version is different from actual. Use this uploaded version?")) {
                            _this.database.set(obj);
                            if (cur.last_change < obj.last_change) {
                                if (_this.database.getUsername()
                                    && (JSON.parse(obj.settings).options.owner === _this.database.getUsername())
                                    && confirm("Also permanently replace " + compName + "?")) {
                                    _this.database.updateComponent(obj);
                                }
                            }
                            _this.database.defineObject(obj.name, Assembler.objects);
                        }
                    }
                });
                _this.manager.editComponent(_this.database.getByName(name));
            };
            reader.readAsText(files[i]);
        }
    } catch (e) {
        notify("Invalid content.");
    }
    $(evt.target).unbind("change");
};

Menu.prototype.upload = function () {
    var evt = document.createEvent("MouseEvents");
    evt.initEvent("click", true, false);
    var node = document.getElementById('uploader');
    $(node).unbind("change");
    node.addEventListener("change", this.handleFileSelect, false);
    node.dispatchEvent(evt);
};

Menu.prototype.getStructure = function(folder){
    console.log(folder.folders);
    console.log(folder.controllers);
};

