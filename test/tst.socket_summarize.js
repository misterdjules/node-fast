/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/tst.socket_summarize.js: tests summarizeSocketAddrs function.
 */

var mod_assertplus = require('assert-plus');
var mod_fs = require('fs');
var mod_net = require('net');
var mod_path = require('path');
var mod_vasync = require('vasync');
var VError = require('verror');

var mod_subr = require('../lib/subr');
var mod_testcommon = require('./common');

var serverPort = mod_testcommon.serverPort;
var serverUds = '/tmp/tst.socket_summarize.js';

function main()
{
	mod_testcommon.registerExitBlocker('test run');
	mod_vasync.forEachPipeline({
	    'inputs': test_cases,
	    'func': runTestCase
	}, function (err) {
		if (err) {
			throw (err);
		}

		mod_testcommon.unregisterExitBlocker('test run');
		console.log('%s tests passed', mod_path.basename(__filename));
	});
}

function runTestCase(testcase, callback)
{
	var barrier, server, client;
	var servers_socket;

	console.log('test case: %s', testcase['name']);

	barrier = mod_vasync.barrier();
	server = mod_net.createServer();
	testcase['listen'](server, function (err) {
		mod_assertplus.ok(!err);
		barrier.start('client connection');
		client = testcase['connect']();
		client.on('connect', function () {
			if (testcase['cleanup']) {
				testcase['cleanup'](function () {
					barrier.done('client connection');
				});
			} else {
				barrier.done('client connection');
			}
		});

		barrier.start('server connection');
		server.on('connection', function (s) {
			servers_socket = s;
			barrier.done('server connection');
		});
	});

	barrier.on('drain', function () {
		var serverSummary, clientSummary;

		serverSummary = mod_subr.summarizeSocketAddrs(servers_socket);
		clientSummary = mod_subr.summarizeSocketAddrs(client);
		testcase['check'](serverSummary, clientSummary);
		server.close();
		servers_socket.destroy();
		client.destroy();
		callback();
	});
}

var test_cases = [ {
    'name': 'IPv4 sockets',
    'listen': function (server, callback) {
	server.listen(serverPort, '127.0.0.1', callback);
    },
    'connect': function () {
	return (mod_net.createConnection(serverPort, '127.0.0.1'));
    },
    'check': function (serverSummary, clientSummary) {
	mod_assertplus.equal(serverSummary.localAddress, '127.0.0.1');
	mod_assertplus.equal(serverSummary.localPort, serverPort);
	mod_assertplus.equal(serverSummary.remoteAddress, '127.0.0.1');
	mod_assertplus.equal(serverSummary.remotePort,
	    clientSummary.localPort);
	mod_assertplus.equal(serverSummary.socketType, 'IPv4');
	mod_assertplus.equal(serverSummary.label,
	    '127.0.0.1:' + clientSummary.localPort);

	mod_assertplus.equal(clientSummary.localAddress, '127.0.0.1');
	mod_assertplus.equal(clientSummary.remoteAddress, '127.0.0.1');
	mod_assertplus.equal(clientSummary.remotePort, serverPort);
	mod_assertplus.equal(clientSummary.socketType, 'IPv4');
	mod_assertplus.equal(clientSummary.label,
	    '127.0.0.1:' + serverPort);
    }

}, {
    'name': 'IPv6 sockets',
    'listen': function (server, callback) {
	server.listen(serverPort, '::1', callback);
    },
    'connect': function () {
	return (mod_net.createConnection(serverPort, '::1'));
    },
    'check': function (serverSummary, clientSummary) {
	mod_assertplus.equal(serverSummary.localAddress, '::1');
	mod_assertplus.equal(serverSummary.localPort, serverPort);
	mod_assertplus.equal(serverSummary.remoteAddress, '::1');
	mod_assertplus.equal(serverSummary.remotePort,
	    clientSummary.localPort);
	mod_assertplus.equal(serverSummary.socketType, 'IPv6');
	mod_assertplus.equal(serverSummary.label,
	    '::1:' + clientSummary.localPort);

	mod_assertplus.equal(clientSummary.localAddress, '::1');
	mod_assertplus.equal(clientSummary.remoteAddress, '::1');
	mod_assertplus.equal(clientSummary.remotePort, serverPort);
	mod_assertplus.equal(clientSummary.socketType, 'IPv6');
	mod_assertplus.equal(clientSummary.label, '::1:' + serverPort);
    }

}, {
    'name': 'UDS sockets',
    'listen': function (server, callback) {
	cleanupUds(function () {
		server.listen(serverUds, callback);
	});
    },
    'connect': function () {
	return (mod_net.createConnection(serverUds));
    },
    'check': function (serverSummary, clientSummary) {
	mod_assertplus.equal(serverSummary.socketType, 'UDS (inferred)');
	mod_assertplus.equal(serverSummary.label, 'UDS');
	mod_assertplus.equal(clientSummary.socketType, 'UDS (inferred)');
	mod_assertplus.equal(clientSummary.label, 'UDS');
    },
    'cleanup': cleanupUds
} ];

function cleanupUds(callback)
{
	mod_fs.unlink(serverUds, function (err) {
		if (err && err['code'] != 'ENOENT') {
			throw (new VError(err, 'failed to unlink "%s"',
			    serverUds));
		}

		callback();
	});
}

main();
