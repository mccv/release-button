# Release software with the push of a button.

This package uses an [Espruino Puck](http://www.puck-js.com/) to release software via [Houston, by Turbine Labs](http://go.turbinelabs.io/release/). The end result can be seen [here](https://twitter.com/mccv/status/871561066920017921).

# Quick Start

This assumes you already have Houston installed and configured. You'll need 

1. a Houston API key
2. the ID of the zone you're running in (which can be found with `tbnctl list zone`)
3. the ID of the release group you want to manage with the button (which can be found with `tbnctl list shared_rules`)
4. the name of your puck (which can be found w/ web ble).

To get the software installed and running, do the following

1. Install software on your Puck by uploading on-puck.js to your Puck. See [the Puck quickstart](https://www.espruino.com/Puck.js+Quick+Start) for details.
2. On your real computer, in this repository `npm install`
3. Also on your real computer, `node index.js -a <api key> -z <zone id> -r <release group id> -p <puck name>`

At this point if you deploy a new, releasable version of software
(where releasable means it's labeled stage=prod, and has a version
different than the current production version) your puck should blink
red. Pushing the button should advance the release in 20%
increments. The blue and green LEDs pulse in proportion to the weight
of the existing version (blue) and releasing version (green). When the
release hits 100% an animation plays on the LEDs and the puck returns
to unlit.

# Details

The code here is split into two parts. The on-puck.js file runs on the puck itself. On the puck we create three bluetooth attributes
* Release Ready (0xABCD) is a writable attribute that indicates whether a release is ready to execute in Houston.
* Desired Release Pct is a readable attribute. When the button is clicked it indicates the release should proceed to the indicate percentage.
* Release Pct is a writable attribute. When the release has been advanced the percentage is written to this attribute.

The index.js file connects to a BLE device advertising these attributes and acts as a bridge  to the Houston service. There are two classes that index.js relies on. Puck.js exports a class that makes interaction with puck easier, and tbn-release.js exports a class that makes interaction with the Houston API easier. Both of these set up event emitters that make index.js pretty simple to follow.

Index.js ends up being (hopefully) pretty self explanatory. Discover a puck and connect. Figure out the current release in Houston. If a new release is available, write that data to the puck. If a release is re-weighted, write that data to the puck. If the puck button requests a new release pct, write data to Houston.



