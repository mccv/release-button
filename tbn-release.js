/** @prettier */
const https = require('https');
const util = require('util');
const events = require('events');

/**
 * class to ease working with the Hosuton API
 */
class TbnRelease {
  constructor(apiKey, zone, releaseGroup) {
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
    let that = this;
    // get our release group
    that.getReleaseGroup(d => {
      that._releaseGroupData = d;
      // figure out the current version
      let metadata = d.result.default.light[0].metadata;
      metadata.forEach(item => {
        if (item.key === 'version' || that.currentVersion === null) {
          that.currentVersion = item.value;
        }
      });
      // now get our cluster, find all versions of instances labeled stage=prod
      let clusterKey = d.result.default.light[0].cluster_key;
      that.getCluster(clusterKey, cluster => {
        that._clusterData = cluster;
        let newVersions = new Set();
        let newReleaseReady = false;
        cluster.result.instances.forEach(item => {
          let version = null;
          let stage = null;
          item.metadata.forEach(md => {
            if (md.key === 'stage') {
              stage = md.value;
            }
            if (md.key === 'version') {
              version = md.value;
            }
          });
          if (stage === 'prod') {
            newVersions.add(version);
            // if we find a prod instance with an unreleased version, a release is ready
            if (version !== that.currentVersion) {
              newReleaseReady = true;
            }
          }
        });
        if (that.releaseReady !== newReleaseReady) {
          that.releaseReady = newReleaseReady;
          // if we toggle into releaseReady, tell people
          that.emit('releaseReady', newReleaseReady);
        }
        that.releaseReady = newReleaseReady;
        that.versions = newVersions;
        // emit an event letting people know we succeeded in a refresh
        that.emit('refresh');
      });
    });
  }

  // create or update a release
  createRelease(releaseTargets) {
    let constraints = [];
    let existingConstraint = this._releaseGroupData.result.default.light[0];
    // create new constraint set
    releaseTargets.forEach(tgt => {
      let newConstraint = {
        cluster_key: existingConstraint.cluster_key,
        metadata: [
          {
            key: 'stage',
            value: 'prod',
          },
          {
            key: 'version',
            value: tgt.version,
          },
        ],
        weight: tgt.weight,
      };
      constraints.push(newConstraint);
    });
    this._releaseGroupData.result.default.light = constraints;
    // push new constraints, emit an update event
    this.updateReleaseGroup(this._releaseGroupData, parsed => {
      this.emit('releaseUpdated', releaseTargets);
    });
  }

  // get a cluster, call a handler
  getCluster(clusterKey, callback) {
    return https.get(
      {
        host: 'api.turbinelabs.io',
        path: '/v1.0/cluster/' + clusterKey,
        headers: {
          'X-Turbine-API-Key': this._apiKey,
        },
        method: 'GET',
      },
      response => {
        let body = '';
        response.on('data', d => {
          body = body + d;
        });
        response.on('end', () => {
          let parsed = JSON.parse(body);
          callback(parsed);
        });
      },
    );
  }

  // fetch our release group, call a handler
  getReleaseGroup(callback) {
    return https.get(
      {
        host: 'api.turbinelabs.io',
        path: '/v1.0/shared_rules/' + this._releaseGroupName,
        headers: {
          'X-Turbine-API-Key': this._apiKey,
        },
        method: 'GET',
      },
      response => {
        let body = '';
        response.on('data', d => {
          body = body + d;
        });
        response.on('end', () => {
          let parsed = JSON.parse(body);
          callback(parsed);
        });
      },
    );
  }

  // update a release group, call a handler
  updateReleaseGroup(d, callback) {
    let req = https.request(
      {
        hostname: 'api.turbinelabs.io',
        port: 443,
        path: '/v1.0/shared_rules/' + this._releaseGroupName,
        headers: {
          'X-Turbine-API-Key': this._apiKey,
          'Content-Type': 'application/json',
        },
        method: 'PUT',
      },
      response => {
        let body = '';
        response.on('data', data => {
          body = body + data;
        });
        response
          .on('end', () => {
            let parsed = JSON.parse(body);
            callback(parsed);
          })
          .on('error', e => {
            console.log('error updating: %j', e);
          });
      },
    );
    let body = JSON.stringify(d.result);
    req.write(body);
    req.end();
  }
}

util.inherits(TbnRelease, events.EventEmitter);

exports.TbnRelease = TbnRelease;
