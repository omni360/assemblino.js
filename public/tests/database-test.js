var tester = new Tester();
tester.pushTest(
    'Requesting sessionInfo',
    function () {
        Assembler.database.sessionInfo.user = '????';
        console.log('old sessionInfo',Assembler.database.sessionInfo);
        Assembler.database.getSessionInfo(function(){
            if (Assembler.database.sessionInfo.user == '????'){
                console.warn('Failed to fetch user name. Is user not logged in?');
            }
            console.log('new sessionInfo',Assembler.database.sessionInfo);
        });
    },
    1000
);





tester.testAll();