/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/compat/common.js: common functions for testing compatiblity of this Fast
 * implementation with an older one.  This is a pain to test because because
 * this module depends on Node v0.12 or later (because of cueball) while
 * versions of the Fast server in use today cannot work on Node v0.12 (because
 * of breaking changes to the V8 API across major versions).  As a result, in
 * order to test this, we need to start a Fast server using a separate version
 * of Node, with a separate node_modules hierarchy that includes the old Fast
 * version.
 */

var mod_assertplus = require('assert-plus');
var mod_child = require('child_process');
var mod_forkexec = require('forkexec');
var mod_fs = require('fs');
var mod_net = require('net');
var mod_path = require('path');
var mod_vasync = require('vasync');
var VError = require('verror');

exports.nodeConfigLoad = nodeConfigLoad;
exports.setupOldServer = setupOldServer;
exports.teardownOldServer = teardownOldServer;

/*
 * Uses the FAST_COMPAT_NODEDIR environment variable to construct paths to the
 * "node" and "npm" executables and then sanity-checks the results.  If that
 * fails for any reason (including a missing environment variable or the node
 * appears to point to the wrong version), emits an error.
 */
function nodeConfigLoad(callback)
{
	var nodedir, nodebin, npmbin;

	if (!process.env['FAST_COMPAT_NODEDIR']) {
		setImmediate(callback, new VError('The compatibility tests ' +
		    'require that the FAST_COMPAT_NODEDIR environment ' +
		    'variable refer to the directory of a Node 0.10 ' +
		    'installation'));
		return;
	}

	nodedir = process.env['FAST_COMPAT_NODEDIR'];
	nodebin = mod_path.join(nodedir, 'bin', 'node');
	npmbin = mod_path.join(nodedir, 'bin', 'npm');

	process.stderr.write('checking node version ... ');
	mod_forkexec.forkExecWait({
	    'argv': [ nodebin, '-v' ]
	}, function (err, info) {
		if (err) {
			process.stderr.write('FAIL\n');
			callback(err);
			return;
		}

		process.stderr.write(info.stdout);
		if (!/^v0\.10\./.test(info.stdout)) {
			callback(new VError('$FAST_COMPAT_NODEDIR/bin/' +
			    'node does not appear to be v0.10'));
		} else {
			callback(null, {
			    'nodebin': nodebin,
			    'npmbin': npmbin
			});
		}
	});
}

/*
 * Instantiates an old-version Fast server and invokes "callback" once the
 * server is listening.  The callback may be invoked with an error.
 *
 *     ip      IP address for the old server to listen on
 *
 *     port    TCP port for the old server to listen on
 */
function setupOldServer(args, callback)
{
	var nodebin, testdir, serverbin, child;

	mod_assertplus.object(args, 'args');
	mod_assertplus.string(args.ip, 'args.ip');
	mod_assertplus.ok(mod_net.isIP(args.ip), 'args.ip is an IP address');
	mod_assertplus.number(args.port, 'args.port');
	mod_assertplus.func(callback, 'callback');

	testdir = __dirname;
	serverbin = mod_path.join(testdir, 'legacy-server.js');

	mod_vasync.pipeline({ 'funcs': [
	    function loadConfig(_, next) {
		nodeConfigLoad(function (err, nc) {
			if (!err) {
				mod_assertplus.object(nc);
				mod_assertplus.string(nc.nodebin);
				nodebin = nc.nodebin;
			}

			next(err);
		});
	    },

	    function startOldServer(_, next) {
		var onexit, onerror;

		console.error('starting legacy server ... ');
		child = mod_child.spawn(nodebin,
		    [ serverbin, '--test-mode', args.ip, args.port ],
		    {
		        'stdio': [
			    process.stdin,
			    process.stdout,
			    process.stderr,
			    'pipe'
			]
		    });

		onexit = function () {
			next(new VError('child unexpectedly exited (have ' +
			    'you set up this repo for compatibility tests?'));
		};
		child.on('exit', onexit);

		onerror = function (err) {
			next(new VError(err, 'child spawn failed'));
		};
		child.on('error', onerror);

		child.stdio[3].once('data', function () {
			/*
			 * Having received any data at all on this file
			 * descriptor indicates the server is now listening.
			 */
			child.removeListener('onerror', onerror);
			child.removeListener('exit', onexit);
			next();
		});
	    }
	] }, function (err) {
		if (err) {
			callback(err);
		} else {
			callback(null, child);
		}
	});
}

function teardownOldServer(child, callback)
{
	process.stderr.write('tearing down server ... ');
	child.on('exit', function () {
		process.stderr.write('done.\n');
		callback();
	});
	child.kill('SIGKILL');
}
