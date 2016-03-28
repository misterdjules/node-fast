/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * lib/demo_server.js: implementations of some RPC functions useful in both the
 * demo server and test suite.
 */

var mod_fs = require('fs');
var mod_lstream = require('lstream');
var mod_stream = require('stream');

var VError = require('verror');

exports.demoRpcs = demoRpcs;

var demoRpc = [
    { 'rpcmethod': 'date',	'rpchandler': fastRpcDate  },
    { 'rpcmethod': 'echo',	'rpchandler': fastRpcEcho  },
    { 'rpcmethod': 'fail',	'rpchandler': fastRpcFail  },
    { 'rpcmethod': 'sleep',	'rpchandler': fastRpcSleep },
    { 'rpcmethod': 'words',	'rpchandler': fastRpcWords },
    { 'rpcmethod': 'yes',	'rpchandler': fastRpcYes   }
];

function demoRpcs()
{
	return (demoRpc);
}

function fastRpcDate(rpc)
{
	var when;

	if (rpc.argv().length !== 0) {
		rpc.fail(new Error('expected no arguments'));
	} else {
		when = new Date();
		rpc.end({
		    'timestamp': when.getTime(),
		    'iso8601': when.toISOString()
		});
	}
}

function fastRpcEcho(rpc)
{
	rpc.argv().forEach(function (a) { rpc.write({ 'value': a }); });
	rpc.end();
}

function fastRpcFail(rpc)
{
	var errspec, rv;

	if (rpc.argv().length != 1) {
		rpc.fail(new Error('expected argument'));
		return;
	}

	errspec = rpc.argv()[0];
	if (typeof (errspec.name) != 'string' ||
	    typeof (errspec.message) != 'string' ||
	    (errspec.info !== undefined && typeof (errspec.info) != 'object')) {
		rpc.fail(new Error('bad arguments'));
		return;
	}

	if (errspec.data && Array.isArray(errspec.data)) {
		errspec.data.forEach(function (d) {
			rpc.write({ 'value': d });
		});
	}

	rv = new VError({
	    'name': errspec.name,
	    'info': errspec.info || {}
	}, '%s', errspec.message);
	if (errspec.context)
		rv.context = errspec.context;

	setImmediate(function () { rpc.fail(rv); });
}

function fastRpcSleep(rpc)
{
	var argv, timems, maxtimems;

	argv = rpc.argv();
	if (argv.length != 1) {
		rpc.fail(new Error('expected one argument'));
		return;
	}

	timems = argv[0].ms;
	maxtimems = 30 * 60 * 1000;	/* 30 minutes */
	if (typeof (timems) != 'number' || timems < 0 || timems > maxtimems) {
		rpc.fail(new Error('bad value for "ms"'));
		return;
	}

	setTimeout(function () { rpc.end(); }, timems);
}

function fastRpcWords(rpc)
{
	var wordfile, wordstream, lstream, xform;

	if (rpc.argv().length !== 0) {
		rpc.fail(new Error('expected 0 arguments'));
		return;
	}

	wordfile = '/usr/dict/words';
	wordstream = mod_fs.createReadStream(wordfile);
	lstream = new mod_lstream();
	wordstream.pipe(lstream);
	xform = new mod_stream.Transform({
	    'objectMode': true,
	    'highWaterMark': 1
	});
	xform._transform = function (c, _, callback) {
		this.push({ 'word': c });
		setImmediate(callback);
	};
	lstream.pipe(xform);
	xform.pipe(rpc);
	wordstream.on('error', function (err) {
		rpc.fail(new VError(err, 'open/read "%s"', wordfile));
	});
}

function fastRpcYes(rpc)
{
	var argv, value, count, i;

	argv = rpc.argv();
	if (argv.length != 1) {
		rpc.fail(new Error('expected one argument'));
		return;
	}

	value = argv[0].value;
	count = argv[0].count;
	if (typeof (count) != 'number' || count < 1 || count > 10240) {
		rpc.fail(new VError({
		    'info': {
			'foundValue': count,
			'minValue': 1,
			'maxValue': 10240
		    }
		}, 'count must be an integer in range [1, 10240]'));
		return;
	}

	for (i = 0; i < count; i++) {
		rpc.write({ 'value': value });
	}

	rpc.end();
}
