var firmata = require('firmata');
var underscore = require('underscore');
var server = require('./local.js');
var board;
var arduinoConnected = false;

server.addCallable("/arduino-init", function (userOptions) {
    function Pin(options) {
        var defaults = {
            mode: board ? board.MODES.OUTPUT : 0,
            value: 0,
            supportedModes: board ? underscore.keys(board.MODES) : [],
            analogChannel: 127  //127 for digital, pin number for analog
        };
        ['mode', 'value', 'supportedModes', 'analogChannel'].map(
            function (key) {
                this[key] = options && options[key] || defaults[key];
            },
            this);
    }

    function initPins() {
        var pins = [];
        for (var i = 0; i < 16; i++) {
            pins.push(new Pin());
        }
        return pins;
    }

    console.log('connecting to arduino at ' + userOptions.boardPath);
    board = new firmata.Board(userOptions.boardPath,
        function (err) {
            arduinoConnected = !err;
            if (err) {
                console.log(err);
                return;
            }
            console.log('arduino connected');
        }
    );
    board.pins = initPins();
    return {status: "connecting..."};
});

server.addCallable("/arduino-check", function (options) {
    console.log('arduino ready:' + arduinoConnected);
    return {status: arduinoConnected};
});

server.addCallable("/arduino-demo", function (options) {

    if (!board) callable["/arduino-init"](options);

    var ledPin = 5;
    var led2Pin = 4;
    var buttonPin = 6;
    var ledState = board.HIGH;

    board.pinMode(ledPin, board.MODES.OUTPUT);
    board.pinMode(led2Pin, board.MODES.OUTPUT);
    board.pinMode(buttonPin, board.MODES.INPUT);

    setInterval(function () {
        ledState = ledState === board.HIGH ? board.LOW : board.HIGH;
        board.digitalWrite(ledPin, ledState);
        board.pinMode(buttonPin, board.MODES.INPUT);
    }, 333);

    board.digitalRead(buttonPin,
        function (value) {
            board.digitalWrite(led2Pin, value);
        }
    );
    console.log('server.js: arduino demo running');
});

server.addCallable("/arduino", function (options) {
    if (!board) return {};
    /*
    //FIXME security issue, remove this functionality
    if (options.functions) {
        for (var i = 0; i < options.functions.length; i++) {
            var index = options.functions[i];
            options.arguments[index] = eval(options.arguments[index]);
        }
    }
    */
    //console.log(options.command + " ( " + options.arguments.join(", ") + " );");
    board[options.command].apply(board, options.arguments);
});

console.log('Arduino interfacing enabled, but not yet connected.');
