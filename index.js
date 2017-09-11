const cmd = require('command-line-args');
const Puck = require('./puck').Puck;
const release = require('./tbn-release');

const optionDefinitions = [
  { name: 'api-key', alias: 'a', type: String },
  { name: 'zone', alias: 'z', type: String },
  { name: 'release-group', alias: 'r', type: String},
  { name: 'puck-name', alias: 'p', type: String},
]

const options = cmd(optionDefinitions);
const apiKey = options['api-key'];
const zone = options.zone;
const releaseGroup = options['release-group'];
const puckName = options['puck-name'];


if (!(options && apiKey && zone && releaseGroup && puckName)) {
  console.log('usage: node index.js -a <api key> '
              + '-z <zone id> -r <release group id> '
              + '-p <puck name>');
  process.exit(1);
}

// connect to a puck. When connected it will emit a connected event.
let puck = new Puck(puckName);
puck.discoverAndConnect();

let tbn = new release.TbnRelease(apiKey, zone, releaseGroup);

puck.on('connected', () => {
  // now we can set up our Tbn object and event handlers
  setInterval(() => {
    tbn.refresh()
  }, 2000);

  // the button was clicked to advance a release
  puck.on('desiredReleasePct', (data) => {
    console.log('setting puck release pct to ' + data.pct);
    let targetVersion = null;
    // picke a version to release.
    // If there are multiple the order is non-determistic.
    tbn.versions.forEach((item) => {
      if (item !== tbn.currentVersion) {
        targetVersion = item;
      }
    })
    // figure out weights. By default Houston uses weights summed to 10000
    let targetWeight = data.pct * 100;
    tbn.createRelease([{
      version: tbn.currentVersion,
      weight: 10000 - targetWeight,
    }, {
      version: targetVersion,
      weight: targetWeight,
    }]);
  });

  // the button was clicked to complete a release
  puck.on('desiredReleaseComplete', (data) => {
    console.log('completing release');
    let targetVersion = null;
    tbn.versions.forEach((item) => {
      if (item !== tbn.currentVersion) {
        targetVersion = item;
      }
    })
    // here we just weight the releasing version to the full 10000
    tbn.createRelease([{
      version: targetVersion,
      weight: 10000,
    }]);
  });

  // just let the console know we're still working
  tbn.on('refresh', () => {
    console.log('data refreshed');
  });

  // Houston has advanced the release, let the puck know
  tbn.on('releaseUpdated', (weights) => {
    console.log('release updated');
    if (weights.length === 1) {
      puck.releasePct(100);
    } else {
      puck.releasePct(weights[1].weight / 100);
    }
  });

  // Houston has a release ready, let the puck know
  tbn.on('releaseReady', (ready) => {
    puck.releaseReady(ready);
    if (ready) {
      console.log('release ready, versions: ' + tbn.versions);
    } else {
      console.log('no longer release ready. Versions: ' + tbn.versions);
    }
  });
});
