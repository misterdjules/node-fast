/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * lib/bench.js: common facilities for basic benchmarking
 */

var mod_assertplus = require('assert-plus');
var VError = require('verror');

exports.fastBenchWorkloads = fastBenchWorkloads;

var FastBenchWorkloads = {
    'sync': {
	'name': 'sync',
	'description': 'uniform, moderate-sized, synchronous requests',
	'cons': FastWorkloadSync
    },

    'sleep150': {
	'name': 'sleep150',
	'description': 'uniform, moderate-sized requests with 150ms sleep',
	'cons': FastWorkloadSleep150
    }
};

function fastBenchWorkloads()
{
	return (FastBenchWorkloads);
}

function FastWorkloadSync() {}
FastWorkloadSync.prototype.name = function () { return ('sync'); };
FastWorkloadSync.prototype.nextRequest = function (fastclient, callback)
{
	return (fastWorkloadRequest({
	    'fastClient': fastclient,
	    'delay': null
	}, callback));
};

function FastWorkloadSleep150() {}
FastWorkloadSleep150.prototype.name = function () { return ('sleep150'); };
FastWorkloadSleep150.prototype.nextRequest = function (fastclient, callback)
{
	return (fastWorkloadRequest({
	    'fastClient': fastclient,
	    'delay': 150
	}, callback));
};

function fastWorkloadRequest(args, callback)
{
	var fastclient, rpcargs, req, ndata;

	fastclient = args.fastClient;
	rpcargs = {
	    'rpcmethod': 'fastbench',
	    'rpcargs': [ {
		'echo': [
		    [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
		    [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
		    [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
		    [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]
		]
	    } ]
	};

	if (args.delay !== null) {
		rpcargs.rpcargs[0]['delay'] = args.delay;
	}

	req = fastclient.rpc(rpcargs);

	ndata = 0;
	req.on('data', function (d) {
		mod_assertplus.deepEqual(d,
		    { 'value': [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ] });
		ndata++;
	});

	req.on('end', function (e) {
		if (ndata != 4) {
			callback(new Error('unexpected data in response'));
		} else {
			callback();
		}
	});

	req.on('error', function (err) {
		callback(new VError(err, 'unexpected server error'));
	});
}
