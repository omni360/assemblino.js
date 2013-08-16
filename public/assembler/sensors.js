function initializeUserCameraVideo(options){
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    window.URL = window.URL || window.webkitURL;
    if (!navigator.getUserMedia) {
        console.log('Sorry. navigator.getUserMedia() is not available.')
    } else {
        navigator.getUserMedia({video: true}, gotStream, noStream);
    }

    var video = document.getElementById('monitor');
    if (!video) {
        var $video = $('<video />',{
            id: 'monitor',
            autoplay: "",
            width: options.width * options.unitPixels,
            height: options.height * options.unitPixels
        });
        $("body").append($video);
        video = document.getElementById('monitor');
    }

    function gotStream(stream) {
        if (window.URL) {
            video.src = window.URL.createObjectURL(stream);
        } else { //opera
            video.src = stream;
            localStream = stream;
        }
        video.onerror = function (e) {
            stream.stop();
            console.error(e);
        };
        stream.onended = noStream;
    }
    function noStream(e) {
        var msg = 'No camera available.';
        if (e.code == 1) {
            msg = 'User denied access to use camera.';
        }
        console.log(msg);
    }

    var videoImage = document.getElementById('videoImage');
    if (!videoImage) {
        var $vi = $('<canvas />',{
            id: 'videoImage',
            width: options.width * options.unitPixels,
            height: options.height * options.unitPixels
        });
        $("body").append($vi);
        videoImage = document.getElementById('videoImage');
    }
    UserCameraScreen.prototype.video = video;
    UserCameraScreen.prototype.videoImage = videoImage;
}

function UserCameraScreen(options){
    options = _.defaults(options || {}, {
        width: 160,
        height: 120,
        unitPixels: 4
    });
    if (!this.video) initializeUserCameraVideo(options);
    var _this = this;
    //change dimensions
    $(this.videoImage).attr('width', options.width * options.unitPixels);
    $(this.videoImage).attr('height', options.height * options.unitPixels);
    $(this.video).attr('width', options.width * options.unitPixels);
    $(this.video).attr('height', options.height * options.unitPixels);
    var videoImageContext = _this.videoImage.getContext( '2d' );
    videoImageContext.fillStyle = '#552233';
    videoImageContext.fillRect( 0, 0, _this.videoImage.width, videoImage.height );
    var videoTexture = new THREE.Texture(_this.videoImage);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    this.videoImageContext = videoImageContext;
    this.videoTexture = videoTexture;
    var movieMaterial = new THREE.MeshBasicMaterial( { map: _this.videoTexture, overdraw: true, side:THREE.DoubleSide } );
    var movieGeometry = new THREE.PlaneGeometry( options.width, options.height, 1, 1 );
    this.target = new THREE.Mesh( movieGeometry, movieMaterial );
}

UserCameraScreen.prototype.addToPart = function (part) {
    var _this = this;
    part.add(this.target);
    part.getScreen = function () {
        return _this;
    };
};

UserCameraScreen.prototype.render = function () {
    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA ){
        this.videoImageContext.drawImage( this.video, 0, 0, this.videoImage.width, this.videoImage.height );
        if ( this.videoTexture) this.videoTexture.needsUpdate = true;
    }
};

UserCameraScreen.prototype.setPosition = function () {
    this.target.position.copy(Vec3.apply(null, arguments));
};

UserCameraScreen.prototype.setRotation = function () {
    this.target.rotation.copy(Vec3.apply(null, arguments));
};


function CameraSensor(options) {
    options = _.defaults(options || {}, {
    });
    var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
    var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
    this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    this.camera.lookAt(Vec3(0, 0, 100));
}

CameraSensor.prototype.addToPart = function (part) {
    var _this = this;
    part.add(this.camera);
    part.getCamera = function () {
        return _this;
    };
};

CameraSensor.prototype.lookAt = function () {
    this.camera.lookAt(Vec3.apply(null, arguments));
};

CameraSensor.prototype.setPosition = function () {
    this.camera.position.copy(Vec3.apply(null, arguments));
};

CameraSensor.prototype.render = function (renderTarget) {
    Assembler.simulator.renderer.render(Assembler.simulator.scene, this.camera, renderTarget, true);
};

function CameraScreen(options) {
    options = _.defaults(options || {}, {
        width: 16,
        height: 16,
        unitPixels: 8
    });
    var screenGeometry = new THREE.PlaneGeometry(options.width, options.height, 1, 1);
    var firstRenderTarget = new THREE.WebGLRenderTarget(options.width * options.unitPixels, options.height * options.unitPixels, { format: THREE.RGBFormat });
    var screenMaterial = new THREE.MeshBasicMaterial({ map: firstRenderTarget });
    this.renderTarget = firstRenderTarget;
    this.target = new THREE.Mesh(screenGeometry, screenMaterial);
}

CameraScreen.prototype.addToPart = function (part) {
    var _this = this;
    part.add(this.target);
    part.getScreen = function () {
        return _this;
    };
};

CameraScreen.prototype.render = function (camera) {
    Assembler.simulator.renderer.render(Assembler.simulator.scene, camera, this.renderTarget, true);
};

CameraScreen.prototype.setPosition = function () {
    this.target.position.copy(Vec3.apply(null, arguments));
};

CameraScreen.prototype.setRotation = function () {
    this.target.rotation.copy(Vec3.apply(null, arguments));
};
