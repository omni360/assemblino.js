
var tester = new Tester();

tester.pushTest(
    'Open Menu » File',
    function () {
        Assembler.menus.FILE_FOLDER.open();
    },
    2000
);

tester.pushTest(
    'Hide Menu » File » Save As',
    function () {
        Assembler.menus.FILE_FOLDER.toggleController('Save As', false, true);
    },
    2000
);

tester.pushTest(
    'Show Menu » File » Save As',
    function () {
        Assembler.menus.FILE_FOLDER.toggleController('Save As', true, true);
    },
    3000
);

tester.pushTest(
    'Close Menu » File',
    function () {
        Assembler.menus.FILE_FOLDER.close();
    },
    2000
);

tester.testAll();