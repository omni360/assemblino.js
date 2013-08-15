'use strict';

/**
 * html5 local database routines
 * if not supported the ram is used to store history and components
 */
function LocalDatabase(user, callback) {
    this.databaseName = user || 'undefined';
    this.usesSQLite = !!window.openDatabase;
    this.open();
    this.createTables(callback);
    this.history = [];
    this.components = [];
}

LocalDatabase.prototype.open = function () {
    if (this.usesSQLite) {
        var dbSize = 5 * 1024 * 1024; // 5MB
        this.db = openDatabase(this.databaseName, "1.0", "AssemblerDesk local database", dbSize);
    }
};

LocalDatabase.prototype.createTables = function (callback) {
    if (this.usesSQLite) {
        var _this = this;
        var db = this.db;
        db.transaction(function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS history(id INT, name TEXT, obj TEXT, last_change BIGINT, pointer INT)", []);
        });
        db.transaction(function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS components(id INT, name TEXT, obj TEXT, last_change BIGINT)", []);
        });
        db.transaction(function (tx) {
            tx.executeSql("CREATE TABLE IF NOT EXISTS options(option TEXT, obj TEXT)", []);
        });
        this.getOption('lastEdited', function(lastEdited){
            _this.lastEdited = lastEdited;
            callback && callback();
        });
    } else {
        callback && setTimeout(callback, 0);
    }
};

LocalDatabase.prototype.updateOption = function (name, obj, callback) {
    if (this.usesSQLite) {
        var _this = this;
        this.getOption(name, function(status){
            if (status===null){
                _this.db.transaction(function (tx) {
                    tx.executeSql("INSERT INTO options(option, obj) VALUES (?,?)",
                        [name, obj],
                        callback,
                        _this.onError);
                });
            } else {
                _this.db.transaction(function (tx) {
                    tx.executeSql("UPDATE options SET obj=? WHERE option=?",
                        [obj, name],
                        callback,
                        _this.onError);
                });
            }
        });

    } else {
        callback && setTimeout(callback,0);
    }
};

LocalDatabase.prototype.getOption = function (name, callback) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT obj FROM options WHERE option=?", [name],
                function renderFunc(tx, rs) {
                    if (rs.rows.length) {
                        callback(rs.rows.item(0)['obj']);
                    } else {
                        callback(null);
                    }
                },
                _this.onError);
        });
    } else {
        setTimeout(callback,0);
    }
};

LocalDatabase.prototype.insertComponent = function (obj) {
    if (!obj) return;
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("INSERT INTO components(id, name, obj, last_change) VALUES (?,?,?,?)",
                [obj.id, obj.name, JSON.stringify(obj), obj.last_change],
                _this.onSuccess,
                _this.onError);
        });
    } else {
        this.components.unshift({
            id: obj.id,
            name: obj.name,
            obj: JSON.stringify(obj),
            last_change: obj.last_change
        });
    }
};

LocalDatabase.prototype.updateComponent = function (obj) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("UPDATE components SET obj=?, last_change=? WHERE id=? OR name=?", [JSON.stringify(obj), obj.last_change, obj.id, obj.id],
                _this.db.onSuccess,
                _this.db.onError);
        });
    } else {
        var saved = _.find(this.components, function (o) {
            return o.id === obj.id || o.name === obj.name;
        });
        if (saved) {
            saved.obj = JSON.stringify(obj);
            saved.last_change = obj.last_change;
        }
    }
};

LocalDatabase.prototype.getComponent = function (id, callback) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM components WHERE name=? OR id=?", [id, id],
                function renderFunc(tx, rs) {
                    if (rs.rows.length) {
                        callback(JSON.parse(rs.rows.item(0)['obj']));
                    } else {
                        callback(null);
                    }
                },
                _this.onError);
        });
    } else {
        var saved = _.find(this.components, function (o) {
            return o.id === id || o.name === id;
        });
        setTimeout(function () {
            if (saved) {
                callback(JSON.parse(saved.obj));
            } else {
                callback(null);
            }
            saved = null;
            callback = null;
        }, 0);
    }
};

LocalDatabase.prototype.getLocalLastChanges = function (callback) {
    var list = {};
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT id, last_change, name FROM components;",
                [],
                function (tx, rs) {
                    for (var i = 0; i < rs.rows.length; i++) {
                        list[rs.rows.item(i).id] = rs.rows.item(i).last_change;
                    }
                    callback(list);
                },
                _this.onError);
        });
    } else {
        _.map(this.components, function (item) {
            list[item.id] = item.last_change;
        });
        setTimeout(function () {
            callback(list);
            list = null;
            callback = null;
        }, 0);
    }
};

LocalDatabase.prototype.getAllComponents = function (callback) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM components;",
                [],
                function (tx, rs) {
                    var list = [];
                    for (var i = 0; i < rs.rows.length; i++) {
                        list.push(rs.rows.item(i));
                    }
                    callback(list);
                },
                _this.onError);
        });
    } else {
        var list = [];
        _.map(this.components, function (item) {
            list.push(item);
        });
        setTimeout(function () {
            callback(list);
            list = null;
            callback = null;
        }, 0);
    }
};

LocalDatabase.prototype.deleteComponent = function (id) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM components WHERE id=? OR name=?", [id, id],
                _this.db.onSuccess,
                _this.db.onError);
        });
    } else {
        var obj = _.find(this.components, function (o) {
            return o.id === id || o.name === id;
        });
        if (obj) {
            this.components = _.without(this.components, obj);
        }
    }
};

LocalDatabase.prototype.deleteAllComponents = function () {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM components;", [],
                _this.db.onSuccess,
                _this.db.onError);
        });
        this.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM history;", [],
                _this.db.onSuccess,
                _this.db.onError);
        });
    } else {
        this.components = [];
        this.history = [];
    }
};

LocalDatabase.prototype.insertHistory = function (obj, pointer) {
    if (!obj) return;
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("DELETE from history WHERE pointer>=? AND (id=? or name=?)", [pointer, obj.id, obj.name]);
            tx.executeSql("INSERT INTO history(id, name, obj, last_change, pointer) VALUES (?,?,?,?,?)",
                [obj.id, obj.name, JSON.stringify(obj), obj.last_change, pointer],
                _this.onSuccess,
                _this.onError);
        });
    } else {
        this.history = _.filter(this.history, function (item) {
            if ((item.id === obj.id || item.name === obj.name) && item.pointer >= pointer) {
                return false;
            }
            return true;
        });
        this.history.unshift({
            id: obj.id,
            name: obj.name,
            obj: JSON.stringify(obj),
            last_change: obj.last_change,
            pointer: pointer
        });
    }
};

LocalDatabase.prototype.getHistoryPoint = function (id, pointer, callback) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM history WHERE (name=? OR id=?) AND (pointer=? OR last_change=?) ORDER BY last_change DESC LIMIT 1;",
                [id, id, pointer, pointer],
                function (tx, rs) {
                    if (rs.rows.length) {
                        callback(JSON.parse(rs.rows.item(0)['obj']));
                    } else {
                        callback(null);
                    }
                },
                _this.onError);
        });
    } else {
        var point = _.find(this.history, function (o) {
            return (o.id === id || o.name === id) && (o.pointer == pointer || o.last_change == pointer);
        });
        setTimeout(
            function () {
                if (point) {
                    callback(JSON.parse(point.obj));
                } else {
                    callback(null);
                }
            }, 0
        );
    }
};

LocalDatabase.prototype.normalizePointer = function (obj, manager) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT pointer FROM history WHERE (id=? OR name=?) AND last_change=? LIMIT 1;",
                [obj.id, obj.name, obj.last_change],
                function (tx, rs) {
                    if (rs.rows.length) {
                        manager.pointer = Number(rs.rows.item(0)['pointer']);
                    } else {
                        manager.pointer = 0;
                    }
                },
                _this.onError);
        });
    } else {
        var pointer = _.find(this.history, function (item) {
            return (item.id == obj.id || item.name === obj.name) && item.last_change == obj.last_change;
        });
        manager.pointer = pointer || 0;
    }
};

LocalDatabase.prototype.getHistoryMarks = function (id, callback) {
    var _this = this;
    if (this.usesSQLite) {
        this.db.transaction(function (tx) {
            tx.executeSql("SELECT last_change FROM history WHERE (name=? OR id=?) ORDER BY last_change DESC;",
                [id, id],
                function (tx, rs) {
                    var list = [];
                    for (var i = 0; i < rs.rows.length; i++) {
                        list.push(rs.rows.item(i)['last_change']);
                    }
                    callback(list);
                },
                _this.onError);
        });
    } else {
        var list = _.filter(this.history, function (item) {
            return item.id == id || item.name === id;
        });
        setTimeout(
            function () {
                callback(list);
                list = null;
                callback = null;
            }, 0
        );
    }
};

LocalDatabase.prototype.deleteObjectHistory = function (id) {
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM history WHERE id=? OR name=?", [id, id],
                _this.db.onSuccess,
                _this.db.onError);
        });
    } else {
        this.history = _.reject(this.history, function (o) {
            return o.id === id || o.name === id;
        });
    }
};

LocalDatabase.prototype.deleteOldHistory = function () {
    var last_change = Date.now() - 7 * 24 * 3600 * 1000; //one week
    if (this.usesSQLite) {
        var _this = this;
        this.db.transaction(function (tx) {
            tx.executeSql("DELETE FROM history WHERE last_change<?", [last_change],
                _this.db.onSuccess,
                _this.db.onError);
        });
    } else {
        this.history = _.reject(this.history, function (o) {
            return o.last_change<last_change;
        });
    }
};

LocalDatabase.prototype.onError = function (tx, e) {
    console.error(e);
};

LocalDatabase.prototype.onSuccess = function (tx, r) {
};



