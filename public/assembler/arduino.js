'use strict';

function Arduino(boardPath) {
    this.boardPath = boardPath;
    this.MODES = {
        INPUT: 0x00,
        OUTPUT: 0x01,
        ANALOG: 0x02,
        PWM: 0x03,
        SERVO: 0x04
    };
    this.HIGH = 1;
    this.LOW = 0;
    this.pinModes = {};
    this.enabled = false;
}

Arduino.prototype.postRequest = function () {
    if (!this.enabled) return;
    postRequest.apply(null, arguments);
};

Arduino.prototype.init = function (time) {
    this.postRequest("/arduino-init", {boardPath: this.boardPath });
    var _this = this;
    setTimeout(function(){
         _this.check();
    }, time || 5000);
};

Arduino.prototype.check = function () {
    var _this = this;
    this.postRequest("/arduino-check", {boardPath: this.boardPath}, function(res){
        _this.connected = JSON.parse(res).status;
    });
};

Arduino.prototype.demo = function () {
    this.postRequest("/arduino-demo", {boardPath: this.boardPath });
};


Arduino.prototype.clean = function(){
    this.servos && _.map(this.servos, function(obj){
        obj.detach();
    });
    this.leds && _.map(this.leds, function(obj){
        obj.detach();
    });
};
/**
 * Use firmata.js docs to find how to use this generic function
 * @param command
 * @param args
 */
Arduino.prototype.sendCommand = function (command, args) {
    var functions = [];
    for (var i = 0; i < args.length; i++) {
        if (typeof args[i] === 'function') {
            args[i] = "(" + args[i] + ")"; //to send it to the node.js server it must be in string format. on node.js use eval(fun).apply(?, args);
            functions.push(i); //functions contains the index where functions are in args
        }
    }
    this.postRequest("/arduino", {
        command: command,
        arguments: args,
        functions: functions
    });
};

Arduino.prototype.setPinMode = function (pin, mode) {
    if (isNaN(pin)) return undefined;
    if (mode === undefined) {
        mode = this.MODES.OUTPUT;
    } else if (isNaN(mode)) { //if its a string
        mode = this.MODES[mode.toUpperCase()];
    }
    //if mode is not in the list
    if (_.values(this.MODES).indexOf(mode) < 0) return undefined;
    this.sendCommand('pinMode', [pin, mode]);
    this.pinModes[pin] = mode;
    return mode;
};

//Leds
(function () {
    Arduino.prototype.Led = Led;

    Arduino.prototype.addLed = function (options) {
        options = _.defaults(options || {}, {
            pin: 13,
            name: nextName('led')
        });
        _.defaults(this, {leds: {}});
        var led = new this.Led(this, options.pin);
        this.leds[options.name] = led;
        return led;
    };

    function Led(board, pin) {
        this.pin = pin;
        this.board = board;
        this.board.setPinMode(this.pin, 'output');
    }

    Led.prototype.toggle = function (value) {
        if (!(this.board.pinModes[this.pin] === this.board.MODES.OUTPUT)) {
            this.board.setPinMode(this.pin, 'output');
        }
        this.board.sendCommand("digitalWrite", [this.pin, value ? this.board.HIGH : this.board.LOW]);
    };

    Led.prototype.attach = function (part, options) {
        options = _.defaults(options || {}, {
            'on': 'lightOn', //part functions to turn on off
            'off': 'lightOff'
        });
        //clear previous attachment
        this.detach();
        var _thisLed = this;
        _thisLed.attached = [part, options];
        _thisLed.originalOn = part[options['on']];
        _thisLed.originalOff = part[options['off']];
        part[options['on']] = function () {
            _thisLed.originalOn.call(part);
            _thisLed.toggle(true);
        };
        part[options['off']] = function () {
            _thisLed.originalOff.call(part);
            _thisLed.toggle(false);
        };
    };

    Led.prototype.detach = function () {
        if (!this.attached) return;
        var part = this.attached[0];
        var options = this.attached[1];
        part[options['on']] = this.originalOn;
        part[options['off']] = this.originalOff;
        this.attached = undefined;
    };

})();
//Buttons
(function () {
    Arduino.prototype.Button = Button;

    Arduino.prototype.addButton = function (options) {
        options = _.defaults(options || {}, {
            pin: 5,
            name: nextName('button')
        });
        _.defaults(this, {buttons: {}});
        var button = new this.Button(this, options.pin);
        this.buttons[options.name] = button;
        return button;
    };

    function Button(board, pin) {
        this.pin = pin;
        this.board = board;
    }

    Button.prototype.read = function (value) {
        function log(value) {
            //FIXME
            console.log('read: ' + value + ' (FIXME: implement web socket to push the reading.)');
        }
        this.sendCommand('digitalRead', [this.pin, log]);
    };

})();
//Servos
(function () {
    Arduino.prototype.Servo = Servo;

    Arduino.prototype.addServo = function (options) {
        options = _.defaults(options || {}, {
            pin: 9,
            name: nextName('servo')
        });
        _.defaults(this, {servos: {}});
        var servo = new this.Servo(this, options.pin);
        this.servos[options.name] = servo;
        return servo;
    };

    function Servo(board, pin) {
        this.pin = pin;
        this.board = board;
        this.board.setPinMode(this.pin, 'servo');
    }

    Servo.prototype.setAngle = function (angle) {
        if (!(this.board.pinModes[this.pin] === this.board.MODES.SERVO)) {
            this.board.setPinMode(this.pin, 'servo');
        }
        this.board.sendCommand('servoWrite', [this.pin, Math.round(angle)]);
    };

    Servo.prototype.attach = function (guiController, options) {
        options = _.defaults(options || {}, {
            scale: 180,
            offset: 91
        });
        this.detach();
        if (guiController instanceof Controller) {
            guiController = guiController.gui;
        }
        if (!guiController || !guiController.__onChange) {
            console.error("Servo.prototype.attach: controller has no GUI!");
            return;
        }
        var _thisServo = this;
        _thisServo.attached = [guiController, options];
        _thisServo.originalOnChange = guiController.__onChange;
        guiController.onChange(function (value) {
            _thisServo.originalOnChange(value);
            _thisServo.setAngle(options.scale * value + options.offset);
        });
    };

    Servo.prototype.detach = function () {
        if (!this.attached) return;
        var controller = this.attached[0];
        controller.onChange(this.originalOnChange);
        this.originalOnChange = undefined;
        this.attached = undefined;
    };

})();