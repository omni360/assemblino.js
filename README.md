assemblino.js
=============

Modeling and simulation for robots and mechanisms

![assembler2](https://f.cloud.github.com/assets/2943816/968190/a5841b48-0597-11e3-8d41-4656b6551f03.jpg)
![assembler10](https://f.cloud.github.com/assets/2943816/968198/a5ac74d0-0597-11e3-9b23-1bb454d81a17.jpg)
![assembler8](https://f.cloud.github.com/assets/2943816/968196/a59fc802-0597-11e3-8800-8f1c7d6f1675.jpg)

Synopsis
---------

With Assemblino you can build a model of a robot selecting **components from the database**, connecting them with **drag and drops**, and use **JavaScript** to program them,
with the possibility to directly connect the model to an **Arduino board** to control the real robot with the same program you model uses.
Assemblino also provides to the real robot a **virtual environment** where such a robot can
test actions before doing them, or learn with **artificial intelligence** algorithms.

Website
-----------

[assemblino.com](https://assemblino.com)

[components and examples](https://assemblino.com/explorer.html)

Requirements
------

This was developed with Linux, Ubuntu 12.04. It should work also on Mac and other versions of Linux. It was not tested on Windows.

Chrome browser is supported and recommended to have full access to all features, mainly because it enables some advanced tools. Does not work properly with other browsers. A minimum 14 inches display is suitable.

Quickstart
------

You need node.js and npm

Clone the repository, cd inside it and do

node server/local.js

open Chrome and go to

http://localhost:35689

Use the menu File to open some of the built-in components and assembles.

Included Dependencies
-------

Many thanks to the developers of the following libraries.

Javascript libraries:
dat.gui, three.js, ThreeCSG, Physi.js, ammo.js, underscore.js, jQuery, jQuery-UI, CodeMirror, markdown.js, brain.js

Included node modules:
async, connect-flash,  event,  express,  firmata,  pause,  serialport,  underscore,  util

Arduino sketch:
StandardFirmata.ino

