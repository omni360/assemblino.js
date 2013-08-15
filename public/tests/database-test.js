var tester = new Tester();
tester.pushTest(
    'Requesting sessionInfo',
    function () {
        Assemblino.database.sessionInfo.user = '????';
        console.log('old sessionInfo',Assemblino.database.sessionInfo);
        Assemblino.database.getSessionInfo(function(){
            if (Assemblino.database.sessionInfo.user == '????'){
                console.warn('Failed to fetch user name. Is user not logged in?');
            }
            console.log('new sessionInfo',Assemblino.database.sessionInfo);
        });
    },
    1000
);





tester.testAll();