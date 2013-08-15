
function Tutorial_02_Moving(){
    /*

     Tutorial 02 - Moving components, Zooming, Rotating

     You will learn the different possibilities for moving, rotating and making components static; and how to zoom, pan
     and rotate the scene.

     While reading this, try interacting with the scene and components focusing on the subject explained.

     1) When <i>Interaction » Connection Mode</i> is enabled components can be moved with the mouse only by clicking and dragging the Connectors.

     2) Without Connection Mode, components can be moved with the mouse by clicking and dragging anywhere on the component.

     3) With <i>Interaction » Soft Handling</i> enabled, components are moved while the physics engine is running, and objects will collide. Soft Handling
        is useful when you want to interact with objects while the simulation is running, sometimes to flip them, or making them collide with other objects on purpose.
        It is also useful when you are connecting objects in a loop.

     4) Without Soft Handling, when moving objects the simulation stops and the objects are moved overwriting their positions
        without the simulation engine, thus passing trough each other. The preferred mode to connect components is without soft handling, because
        they should be somehow static when you do that. Disabling soft handling allows you to free objects when they are stuck.

     5) To zoom in and out you may a)try the mouse wheel or b)by pressing the mouse button and key S, while moving the mouse forth and backwards.

     6) To pan the scene press the mouse button and key D, while moving the mouse in any direction.

     7) To rotate the scene a) try click and drag anywhere except on components or b) Press the mouse button and key A while moving the mouse in any direction.

     8) If you what to make and object completely static, so that it will not move even if heavier objects collide with it, or it can stand
     static in the air, without support: change it's mass temporarily to 0. You can do that by selecting the object, and then clicking
     <i>Interaction » Context » (Component Name) » Properties</i> and if the object has a mass property, set it to 0, press Enter and click Save.
     This technique can be useful when connecting components.
     */

}