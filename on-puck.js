// run this on the puck itself

var releasePct = 0;
var releasing = false;
var releaseStep = 0;
var releaseReady = false;
var redLight = 0;


/**
 *  blink the red LED starting at a time 500ms*i in the future
 */
function blinks(i) {
  setTimeout(() => {
    leds(0, 0, 1);
  }, i * 500);
  setTimeout(() => {
    leds(0, 1, 0);
  }, (i * 500) + 250);
}

/**
 * light all LEDs for half a second starting at a time 500ms*i in the future
 */
function hold(i) {
  setTimeout(() => {
    leds(1, 1, 1);
  }, i * 500);
  setTimeout(() => {
    leds(0, 0, 0);
  }, (i * 500) + 2000);
}

/**
 * played at the end of the release. Blink red -> green -> blue, then hold
 */
function wrapUpAnimation() {
  blinks(1);
  blinks(2);
  blinks(3);
  hold(4);
}

/**
 * toggle blue/green LEDs in proportion to current release weight
 */
function releaseAnimation() {
  if (releasePct > 0) {
    releaseStep += 1;
    if (releaseStep % 10 > releasePct/10) {
      leds(0, 1, 0);
    } else {
      leds(0, 0, 1);
    }
    setTimeout(releaseAnimation, 200);
  } else {
    leds(0, 0, 0);
  }
}

/**
 * pulse the red light if a release is ready
 */
function pulseRed() {
  if (releaseReady) {
    redLight = (redLight + 1) % 2;
    leds(redLight, 0, 0);
    setTimeout(pulseRed, 500);
  } else {
    leds(0, 0, 0);
  }
}

function leds(red, green, blue) {
  LED1.write(red);
  LED2.write(green);
  LED3.write(blue);
}

/**
 * called when the release pct attribute is written
 */
function writeReleasePct(evt) {
  console.log("got event: " + JSON.stringify(evt));
  releasePct = evt.data[0];
  console.log("release pct: " + releasePct);
  // if we're all done releasing play the wrapup animation and
  // reset release pct to zero
  if (releasePct == 100) {
    wrapUpAnimation();
    releasePct = 0;
  } else if (releasePct > 0) {
    // if we're in the middle of a release play the release animation
    releaseReady = false;
    releaseAnimation();
  }
}

/**
 * called when the release ready attribute is written
 */
function writeReleaseReady(evt) {
  console.log("release ready: " + JSON.stringify(evt));
  var ready = parseInt(evt.data.toString());
  if (ready === 0) {
    releaseReady = false;
  } else {
    releaseReady = true;
    pulseRed();
  }
}

/**
 * when the host disconnects quiesce the things
 */
NRF.on('disconnect', (reason) => {
  leds(0, 0, 0);
  releasePct = 0;
  releasing = false;
  releaseReady = false;  
});

/**
 * create our BLE attributes and advertise them
 */
NRF.setServices({
  0xBCDE: {
    0xABCD: {
      description: "Release Ready", 
      value: "false",
      writable: true,
      onWrite: writeReleaseReady
    },
    0xABCE: {
      description: "Desired Release Pct",
      value: releasePct,
      notify: true,
      readable: true
    },
    0xABCF: {
      description: "Release Pct",
      value: "0",
      writable: true,
      onWrite: writeReleasePct
    }
  }
}, {advertise: ['BCDE']});

/**
 * called when the button is pressed
 */
function btnPressed() {
  console.log("button pressed");
  // set LEDs off, which may get overwritten by an animation
  leds(0, 0, 0);
  releaseReady = false;
  var desiredReleasePct = releasePct + 20;
  // clamp
  if (desiredReleasePct > 100) {
    desiredReleasePct = 100;
  }
  // single byte silliness
  var transmitReleasePct = (desiredReleasePct / 10).toString();
  if (transmitReleasePct == "10") {
    transmitReleasePct = "A";
  }
  console.log("sending drp " + transmitReleasePct);
  NRF.updateServices({
    0xABCD: {
       0xABCE: {
         value: transmitReleasePct,
         notify: true
       }
    }
  });
}

// set up a handler for our button press
setWatch(btnPressed, BTN, {edge:"rising",
                           repeat:true,
                           debounce:50});

