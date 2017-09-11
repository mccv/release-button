/** @prettier */
// a class to interact with the puck over BLE, assuming it's running on-puck.js

const noble = require('noble');
const events = require('events');
const util = require('util');

// const NRFUART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';
const NRFUART_NOTIFY_CHAR = '6e400003b5a3f393e0a9e50e24dcca9e';
const NRFUART_WRITE_CHAR = '6e400002b5a3f393e0a9e50e24dcca9e';
const RELEASE_READY_CHAR = 'abcd';
const RELEASE_DESIRED_PCT_CHAR = 'abce';
const RELEASE_PCT_CHAR = 'abcf';

// new Puck("Puck.js 144d")
function Puck(name) {
  this._puckName = name;
  this._nrfNotifyChar = null;
  this._nrfWriteChar = null;
  this._releaseReadyChar = null;
  this._releaseDesiredPctChar = null;
  this._releasePctChar = null;
  this._peripheral = null;
}

util.inherits(Puck, events.EventEmitter);

Puck.prototype.disconnect = () => {
  console.log('disconnecting and exiting');
  this._peripheral.disconnect(e => {
    if (e) {
      console.log('failed to disconnect from the puck ' + e);
      process.exit(1);
    } else {
      console.log('disconnected');
      process.exit(0);
    }
  });
};

// called internally to set up event handlers
Puck.prototype.initButtonWatcher = () => {
  this._releaseDesiredPctChar.subscribe(error => {
    if (error) {
      console.log("couldn't subscribe to button click: ", error);
      process.exit(1);
    }
  });
  this._releaseDesiredPctChar.on('data', data => {
    if (data === 'A') {
      // complete release
      console.log('desired release completed');
      this.emit('desiredReleaseComplete');
    } else {
      let desiredPct = parseInt(data) * 10;
      console.log('desired release pct is now ' + desiredPct);
      this.emit('desiredReleasePct', { pct: desiredPct });
    }
  });
};

// called internally to set up UART logger
Puck.prototype.initPuckLogger = () => {
  this._nrfNotifyChar.subscribe(error => {
    if (error) {
      console.log("couldn't subscribe to UART: ", error);
      process.exit(1);
    }
  });
  this._nrfNotifyChar.on('data', data => {
    let logLine = data.toString();
    if (logLine.startsWith('> ')) {
      logLine = logLine.substr(2);
    }
    if (logLine.endsWith('\n>')) {
      logLine = logLine.substr(0, logLine.length - 2);
    }
    console.log('puck: ' + logLine);
  });
};

// scan BLE devices, find one that advertises the attributes we need to work
Puck.prototype.discoverAndConnect = () => {
  let puck = this;
  noble.on('stateChange', state => {
    if (state === 'poweredOn') {
      noble.startScanning();
    }
  });
  noble.on('discover', p => {
    console.log('found device: ' + p.advertisement.localName);
    if (p.advertisement.localName === puck._name) {
      console.log('connecting to puck');
      p.once('disconnect', () => {
        console.log('disconnected');
        process.exit(0);
      });
      p.once('connect', () => {
        console.log('connected to puck');
        p.discoverAllServicesAndCharacteristics((e, svcs, characteristics) => {
          if (e) {
            console.log('oops, error discovering svcs/characteristics: %v', e);
            process.exit(1);
          }
          characteristics.forEach(c => {
            switch (c.uuid) {
              case RELEASE_READY_CHAR:
                puck._releaseReadyChar = c;
                break;
              case RELEASE_DESIRED_PCT_CHAR:
                puck._releaseDesiredPctChar = c;
                puck.initButtonWatcher();
                break;
              case RELEASE_PCT_CHAR:
                puck._releasePctChar = c;
                break;
              case NRFUART_NOTIFY_CHAR:
                puck._nrfNotifyChar = c;
                puck.initPuckLogger();
                break;
              case NRFUART_WRITE_CHAR:
                puck._nrfWriteChar = c;
                break;
              default:
                console.log('unhandled characteristic: ' + c.uuid);
            }
          });
          puck.emit('connected');
        });
      });
      p.connect(error => {
        if (error) {
          console.log('failed to connect to the puck ' + error);
          process.exit(1);
        }
      });
    }
  });
};

Puck.prototype.releaseReady = ready => {
  if (ready) {
    this._releaseReadyChar.write(new Buffer([1]), true);
  } else {
    this._releaseReadyChar.write(new Buffer([0]), true);
  }
};

Puck.prototype.releasePct = pct => {
  console.log('setting release pct to ' + pct);
  let b = new Buffer([pct]);
  this._releasePctChar.write(b, true);
};

exports.Puck = Puck;
