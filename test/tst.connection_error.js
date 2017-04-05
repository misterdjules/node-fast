/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

/*
 * test/tst.connection_error.js: Test server shutdown after a connection error.
 */

var mod_bunyan = require('bunyan');
var mod_fast = require('../lib/fast');
var mod_net = require('net');
var mod_path = require('path');
var mod_vasync = require('vasync');

var LOG = mod_bunyan.createLogger({
	name: mod_path.basename(__filename),
	level: process.env['LOG_LEVEL' ] || 'fatal'
});

var PORT = 2000;

var SERVER_SOCK = null;
var SERVER_FAST = null;
var CLIENT_SOCK = null;
var CLIENT_FAST = null;

var RPC = null;

function endpoint(rpc) {
	RPC = rpc;
}

mod_vasync.pipeline({ funcs: [
	function (_, cb) {
		LOG.info('setting up server');

		SERVER_SOCK = mod_net.createServer({ allowHalfOpen: false });

		SERVER_SOCK.on('error', cb);

		SERVER_SOCK.on('listening', function () {
			LOG.info('server listening');
			cb();
		});

		SERVER_FAST = new mod_fast.FastServer({
			log: LOG.child({ component: 'fast-server' }),
			server: SERVER_SOCK
		});

		SERVER_FAST.registerRpcMethod({
			rpcmethod: 'endpoint',
			rpchandler: endpoint
		});

		SERVER_SOCK.listen(PORT);
	},
	function (_, cb) {
		LOG.info('setting up client');

		CLIENT_SOCK = mod_net.connect(PORT, '127.0.0.1');

		CLIENT_SOCK.on('error', cb);

		CLIENT_SOCK.on('connect', function () {
			LOG.info('client socket connected');

			CLIENT_FAST = new mod_fast.FastClient({
				log: LOG.child({ component: 'fast-client' }),
				nRecentRequests: 100,
				transport: CLIENT_SOCK
			});

			cb();
		});
	},
	function (_, cb) {
		LOG.info('performing rpc');

		var req = CLIENT_FAST.rpc({
			rpcmethod: 'endpoint',
			rpcargs: [ ],
			log: LOG
		});

		req.on('data', function (data) {
			LOG.info({ data: data }, 'RPC received data');
		});

		req.on('error', function (err) {
			LOG.info(err, 'RPC had error');
		});

		req.on('end', function (err) {
			LOG.info(err, 'RPC ended');
		});

		cb();
	},
	function (_, cb) {
		LOG.info('destroying client');

		/* Close the socket to cause onConnectionError. */
		CLIENT_FAST.detach();
		CLIENT_SOCK.destroy();

		LOG.info('server ends rpc');

		/* Respond to generate a socket error. */
		RPC.write({ a: 'foo' });
		RPC.end();

		LOG.info('server shutting down');

		/* Server then goes to shut down. */
		SERVER_SOCK.on('close', function () {
			SERVER_FAST.close();
			cb();
		});
		SERVER_SOCK.close();
	}
] }, function (err) {
	if (err) {
		throw err;
	}

	LOG.info('finished');
});
