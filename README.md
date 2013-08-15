assemblino.js
=============

Modeling and simulation for robots and mechanisms

![assembler2](https://f.cloud.github.com/assets/2943816/968190/a5841b48-0597-11e3-8d41-4656b6551f03.jpg)
![assembler10](https://f.cloud.github.com/assets/2943816/968198/a5ac74d0-0597-11e3-9b23-1bb454d81a17.jpg)
![assembler8](https://f.cloud.github.com/assets/2943816/968196/a59fc802-0597-11e3-8800-8f1c7d6f1675.jpg)

Website
-----------

[assemblino.com](https://assemblino.com)

[components and examples](https://assemblino.com/explorer.html)

About
-------------

Assemblino is a tool for building simple models of robots and mechanisms. It has a graphical 3D interface and performs physical simulations. The name means small assemble, in Italian. Currently an alpha version is available for testing.

It aims at ease of use and is suitable to model abstractions rather than exact layouts.

In the database there are some of the common components used for robot construction, such as servo motors, linear motors, wheels and plates.

The simulation of actuators behavior is done primarily with sliders. With some knowledge of JavaScript you can also automate and program the models, process keyboard and mouse events.

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

Dependencies
-------

Many thanks to the developers of the following libraries.

Javascript libraries:
dat.gui, three.js, ThreeCSG, Physi.js, ammo.js, underscore.js, jQuery, jQuery-UI, CodeMirror, markdown.js

Included node modules:
async, connect-flash,  event,  express,  firmata,  pause,  serialport,  underscore,  util

Arduino sketch:
StandardFirmata.ino

Screenshots
------------

![assembler1](https://f.cloud.github.com/assets/2943816/968189/a58371de-0597-11e3-9919-e2f2e633179a.jpg)
![assembler4](https://f.cloud.github.com/assets/2943816/968191/a58a6e1c-0597-11e3-9319-5a73c076c1db.jpg)
![assembler3](https://f.cloud.github.com/assets/2943816/968192/a58f1476-0597-11e3-8130-cb8e869bc307.jpg)
![assembler5](https://f.cloud.github.com/assets/2943816/968193/a592bd56-0597-11e3-9afd-816f90dff50d.jpg)
![assembler6](https://f.cloud.github.com/assets/2943816/968194/a59483e8-0597-11e3-9d3e-548f92092e67.jpg)
![assembler7](https://f.cloud.github.com/assets/2943816/968195/a59d1b84-0597-11e3-9661-adbcc0c6dea2.jpg)
![assembler9](https://f.cloud.github.com/assets/2943816/968197/a5a38014-0597-11e3-8ac3-c3ab4f88aeb2.jpg)
![assembler11](https://f.cloud.github.com/assets/2943816/968199/a5ae9030-0597-11e3-8e23-3b960e477e40.jpg)
![assembler12](https://f.cloud.github.com/assets/2943816/968200/a5b6bbc0-0597-11e3-8c32-a06a358ddcae.jpg)

