/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/compat/legacy-server.js: start an old-version Fast server listening on
 * the specified port.
 */

/*
 * NOTE: Unlike the rest of this project, this code is executed with Node 0.10!
 * WE should not make use of any dependencies aside from the legacy node-fast
 * implementation.  If we need to use more dependencies, we need to update
 * setupOldServer() to make sure these are installed.
 */
var mod_fs = require('fs');
var mod_legacyfast = require('fast');
var mod_net = require('net');
var mod_path = require('path');
var server;

function usage()
{
	console.error('usage: node %s IP PORT', mod_path.basename(__filename));
	process.exit(2);
}

function main()
{
	var ip, port, args, testmode;

	args = process.argv.slice(2);
	if (args.length > 0 && args[0] == '--test-mode') {
		testmode = true;
		args.shift();
	}

	if (args.length != 2) {
		usage();
	}

	ip = args[0];
	port = args[1];
	if (!mod_net.isIP(ip) || isNaN(port) || port <= 0 || port > 65535) {
		console.error('bad IP or port number');
		usage();
	}

	server = mod_legacyfast.createServer();
	console.error('legacy server: startup (pid %d)', process.pid);
	server.listen(port, ip, function () {
		console.error('legacy server: listening on %s:%d', ip, port);
		setupRpcHandlers();

		if (testmode) {
			exitWhenParentDies();
			notifyParent();
		}
	});
}

/*
 * The way this program is launched, our parent process is sitting on the other
 * end of the pipe at fd 3, and we notify it that we're listening by writing
 * data on this pipe.
 */
function notifyParent()
{
	var message, buf;

	message = 'server ready';
	buf = new Buffer(Buffer.byteLength(message, 'utf8'));
	buf.write(message);
	mod_fs.write(3, buf, 0, buf.length, null, function (err) {
		if (err) {
			console.error('legacy server: error writing to ' +
			    'parent: %s', err.message);
			process.exit(1);
		}
	});
}

/*
 * This program should exit when the parent goes away.  This mechanism only
 * works because the parent has set up a pipe on fd 3, which will be closed when
 * that process exits.
 */
function exitWhenParentDies()
{
	var buf = new Buffer(1);
	mod_fs.read(3, buf, 0, 1, null, function (err) {
		console.error('legacy server: ' +
		    'terminating after read from parent');
		server.close();
	});
}

function setupRpcHandlers()
{
	server.rpc('echo', function () {
		var response, args;

		/*
		 * The varargs behavior of the original API makes this the
		 * simplest way to get the arguments.
		 */
		response = arguments[arguments.length - 1];
		args = Array.prototype.slice.call(
		    arguments, 0, arguments.length - 1);
		if (args.length == 1 && args[0] === null) {
			response.end(null);
			return;
		}

		if (args.length != 1 || typeof (args[0]) != 'object' ||
		    !Array.isArray(args[0].values) ||
		    typeof (args[0].errorResult) != 'boolean') {
			response.end(new Error('bad arguments'));
			return;
		}

		args[0].values.forEach(function (v) {
			response.write(v);
		});

		if (args[0].errorResult) {
			var err = new Error('boom boom!');
			err.context = { 'result': 'poof' };
			response.end(err);
		} else {
			response.end();
		}
	});

	server.rpc('fastbench', function () {
		var response, args;

		/*
		 * The varargs behavior of the original API makes this the
		 * simplest way to get the arguments.
		 */
		response = arguments[arguments.length - 1];
		args = Array.prototype.slice.call(
		    arguments, 0, arguments.length - 1);
		if (args.length != 1 && typeof (args[0]) != 'object' ||
		    args[0] === null) {
			response.end(new Error('bad arguments'));
			return;
		}

		args = args[0];
		if (!args.hasOwnProperty('echo') ||
		    !Array.isArray(args['echo'])) {
			response.end(new Error('expected arg.echo'));
			return;
		}

		if (typeof (args['delay']) == 'number') {
			setTimeout(fastRpcFastbenchFinish, args['delay'],
			    response, args['echo']);
		} else {
			fastRpcFastbenchFinish(response, args['echo']);
		}
	});

	function fastRpcFastbenchFinish(response, values) {
		values.forEach(
		    function (a) { response.write({ 'value': a }); });
		response.end();
	}
}

main();
