function Tester() {
    this.sequence = []; //list of functions
}

Tester.prototype.pushTest = function (name, fun, delay) {
    this.sequence.push({
        name: name,
        fun: fun,
        delay: delay || 0
    })
};

Tester.prototype.shiftAndTest = function (all) {
    var test = this.sequence.shift();
    if (!test) {
        Assembler.menus.showInfo('End of tests');
        console.log('End of tests');
        return;
    }
    var _this = this;
    console.log("+" + test.delay, test.name);
    Assembler.menus.showInfo(test.name);
    setTimeout(
        function(){
            try {
                test.fun();
            } catch (e){
                console.error(e);
            }
            if (all) _this.shiftAndTest(all);
        },
        test.delay
    );
    return test;
};

Tester.prototype.testAll = function () {
    this.shiftAndTest(true);
};

