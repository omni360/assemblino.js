var tester = new Tester();
tester.pushTest(
    'Testing defined components in the database',
    function () {
        _.map(Assembler.objects, function (fun, key) {
            console.log(key, 'starting test');
            TRACKER.clear("-");
            try {
                var o = fun();
                if (o) {
                    if (o instanceof Assemble) {
                        o = o.compile();
                        if (!o) {
                            console.warn(key, 'failed 2nd execution');
                        } else {
                            console.log(key, 'OK');
                        }
                    } else {
                        console.log(key, 'OK');
                    }
                } else {
                    console.warn(key, 'failed 1st execution');
                }
            } catch (e) {
                console.error(key, 'failed execution');
            }
        });
    },
    1000
);

tester.testAll();