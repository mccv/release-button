const https = require('https');
const util = require('util');
const events = require('events');

/**
 * class to ease working with the Hosuton API
 */
class TbnRelease {
  constructor (apiKey, zone, releaseGroup) {
    this._apiKey = apiKey;
    this._zone = zone;
    this._releaseGroupName = releaseGroup;
    this._releaseGroupData = null;
    this._clusterData = null;
    this.currentVersion = '';
    this.releaseReady = false;
    this.versions = [];
  }

  // refresh release group data
  refresh() {
    var that = this;
    // get our release group
    that.getReleaseGroup(function(d) {
      that._releaseGroupData = d;
      // figure out the current version
      var metadata = d.result.default.light[0].metadata;
      metadata.forEach((item) => {
        if (item.key == "version" || that.currentVersion == null) {
          that.currentVersion = item.value;
        }
      })
      // now get our cluster, find all versions of instances labeled stage=prod
      var clusterKey = d.result.default.light[0].cluster_key;
      that.getCluster(clusterKey, (cluster) => {
        that._clusterData = cluster;
        var newVersions = new Set();
        var newReleaseReady = false;
        cluster.result.instances.forEach((item) => {
          var version = null;
          var stage = null;
          var releaseReady = false;
          item.metadata.forEach((md) => {
            if (md.key == "stage") {
              stage = md.value;
            }
            if (md.key == "version") {
              version = md.value;
            }
          })
          if(stage == "prod") {
            newVersions.add(version);
            // if we find a prod instance with an unreleased version, a release is ready
            if (version != that.currentVersion) {
              newReleaseReady = true;
            }
          }
        })
        if (that.releaseReady != newReleaseReady) {
          that.releaseReady = newReleaseReady;
          // if we toggle into releaseReady, tell people
          that.emit('releaseReady', newReleaseReady);
        }
        that.releaseReady = newReleaseReady;
        that.versions = newVersions;
        // emit an event letting people know we succeeded in a refresh
        that.emit('refresh');
      });
    })
  }                

  // create or update a release
  createRelease(releaseTargets) {
    
    var constraints = [];
    var existingConstraint = this._releaseGroupData.result.default.light[0];
    // create new constraint set
    releaseTargets.forEach((tgt) => {
      var newConstraint = {
        cluster_key: existingConstraint.cluster_key,
        metadata: [
          {
            key: "stage",
            value: "prod"
          },
          {
            key: "version",
            value: tgt.version
          }
        ],
        weight: tgt.weight
      }
      constraints.push(newConstraint);
    })
    this._releaseGroupData.result.default.light = constraints;
    // push new constraints, emit an update event
    this.updateReleaseGroup(this._releaseGroupData, (parsed) => {
      this.emit('releaseUpdated', releaseTargets);
    });
  }

  // get a cluster, call a handler
  getCluster(clusterKey, callback) {
    return https.get({
      host: 'api.turbinelabs.io',
      path: '/v1.0/cluster/' + clusterKey,
      headers: {
        'X-Turbine-API-Key': this._apiKey
      },
      method: 'GET'
    }, function(response) {
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        var parsed = JSON.parse(body)
        callback(parsed)
      });
    })
  }

  // fetch our release group, call a handler
  getReleaseGroup(callback) {
    return https.get({
      host: 'api.turbinelabs.io',
      path: '/v1.0/shared_rules/' + this._releaseGroupName,
      headers: {
        'X-Turbine-API-Key': this._apiKey
      },
      method: 'GET'
    }, function(response) {
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        var parsed = JSON.parse(body)
        callback(parsed)
      });
    })
  }

  // update a release group, call a handler
  updateReleaseGroup(d, callback) {
    var req = https.request({
      hostname: 'api.turbinelabs.io',
      port: 443,
      path: '/v1.0/shared_rules/' + this._releaseGroupName,
      headers: {
        'X-Turbine-API-Key': this._apiKey,
        'Content-Type': 'application/json'
      },
      method: 'PUT',
    }, function(response) {
      var body = '';
      response.on('data', function(d) {
        body += d;
      });
      response.on('end', function() {
        var parsed = JSON.parse(body)
        callback(parsed)
      }).on('error', function(e) {
        console.log("error updating: %j", e);
      })
    })
    var body = JSON.stringify(d.result);
    req.write(body);
    req.end();
  }
}

util.inherits(TbnRelease, events.EventEmitter);

exports.TbnRelease = TbnRelease;
