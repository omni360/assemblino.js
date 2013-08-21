
/**
 * Tools for local development with a Javascript IDE
 */

var DESKTOP_OPTIONS = {
    enabled: true,
    autoSave: false,
    flashStatus: true,
    globalName: 'DESK_DEVELOPER',
    folder: 'components/'
};

function DesktopDevelopment(name) {
    if (!name) return;
    this.uri = DESKTOP_OPTIONS.folder + name + ".js";
    this.name = name;
    this.assume(name);
}

DesktopDevelopment.prototype.reassign = function () {
    DesktopDevelopment.prototype.constructor.apply(this, arguments);
};

DesktopDevelopment.prototype.validateUser = function (owner) {
    return Assembler.database.getUsername() == owner;
};

DesktopDevelopment.prototype.assume = function (name) {
    return this.object = Assembler.database.getByName(name);
};

DesktopDevelopment.prototype.updateLastChange = function (now) {
    this.object.last_change = now || Date.now();
};

DesktopDevelopment.prototype.setAsLastEdited = function () {
    Assembler.database.saveInfo('lastEdited', this.object.name);
};

DesktopDevelopment.prototype.setCode = function (fun) {
    var code = "" + (fun || window[this.name]);
    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
    code = code.replace(/\n        /mg, '\n  ');
    code = code.replace(/\n    /mg, '\n');
    this.updateLastChange();
    this.object.code = code;
};

DesktopDevelopment.prototype.setProgram = function (fun) {
    var code = "" + (fun || window[this.name]);
    code = code.substring(code.indexOf('{') + 1, code.lastIndexOf('}'));
    code = code.replace(/\n        /mg, '\n  ');
    code = code.replace(/\n    /mg, '\n');
    var sets = JSON.parse(this.object.settings);
    sets.program = code;
    this.updateLastChange();
    this.object.settings = JSON.stringify(sets);
};

DesktopDevelopment.prototype.executeCodeFun = function () {
    TRACKER.clear(this.name);
    return window[this.name]();
};

DesktopDevelopment.prototype.extendOptions = function (options) {
    var sets = JSON.parse(this.object.settings);
    _.extend(sets.options, options || {});
    this.updateLastChange();
    this.object.settings = JSON.stringify(sets);
};

DesktopDevelopment.prototype.updateHistory = function () {
    var sets = JSON.parse(this.object.settings);
    var pointer = ++sets.pointer;
    var _this = this;
    Assembler.manager.localDatabase.insertHistory({
        id: _this.object.id,
        name: _this.object.name,
        code: _this.object.code,
        settings: sets,
        last_change: _this.object.last_change
    }, pointer);
    this.object.settings = JSON.stringify(sets);
};

DesktopDevelopment.prototype.update = function () {
    var _this = this;
    autoReload(callback);
    function autoReload(callback) {
        jQuery.ajax(_this.uri, {
            type: 'GET',
            cache: false,
            success: callback,
            error: function () {
                Assembler.menus.showInfo('<span class="red">' + 'Failure loading:<br/>' + _this.uri + "</span>");
            }
        });
    }

    function callback(data) {
        //add to dom?! usefull for debug!?
        if (false) {
            var sc1 = document.getElementById("devScript");
            var sc2 = document.createElement("script");
            sc2.innerHTML = data;
            sc2.id = "devScript";
            document.body.replaceChild(sc2, sc1);
        }
        //
        var obj;
        if (Assembler.manager.object instanceof Assemble) {
            _this.setProgram();
        } else if (obj = _this.executeCodeFun()) {
            _this.setCode();
        }
        Assembler.manager.reload(_this.name, obj || undefined);
        if (DESKTOP_OPTIONS.autoSave) {
            Assembler.manager.saveComponent();
            DESKTOP_OPTIONS.flashStatus && Assembler.menus.flashStatus("Reloaded and Saved from Desktop");
        } else {
            DESKTOP_OPTIONS.flashStatus && Assembler.menus.flashStatus("Reloaded from Desktop");
        }
    }
};

