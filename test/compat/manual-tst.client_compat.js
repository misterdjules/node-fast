/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/compat/tst.client_compat.js: tests compatibility of the new client
 * against an old server.
 */

var mod_assertplus = require('assert-plus');
var mod_bunyan = require('bunyan');
var mod_cmdutil = require('cmdutil');
var mod_fast = require('../../lib/fast');
var mod_path = require('path');
var mod_net = require('net');
var mod_vasync = require('vasync');
var VError = require('verror');

var mod_testcommon = require('../common');
var mod_testcompat = require('./common');
var testLog, testcases;

function main()
{
	testLog = new mod_bunyan({
	    'name': mod_path.basename(__filename),
	    'level': process.env['LOG_LEVEL'] || 'fatal'
	});

	mod_testcommon.registerExitBlocker('tests');

	mod_testcompat.setupOldServer({
	    'ip': mod_testcommon.serverIp,
	    'port': mod_testcommon.serverPort
	}, function (err, old) {
		if (err) {
			mod_cmdutil.fail(err);
		}

		mod_vasync.forEachPipeline({
		    'inputs': testcases,
		    'func': runTestCase
		}, function (err2) {
			mod_testcompat.teardownOldServer(old, function () {
				if (err2) {
					mod_cmdutil.fail(err2);
				}

				console.error('%s tests passed',
				    mod_path.basename(__filename));
				mod_testcommon.unregisterExitBlocker('tests');
			});
		});
	});
}

function runTestCase(testcase, callback)
{
	var log, csock, cclient;

	console.error('test case: %s', testcase['name']);
	log = testLog.child({ 'testcase': testcase['name'] });
	csock = mod_net.createConnection(mod_testcommon.serverPort,
	    mod_testcommon.serverIp);
	cclient = new mod_fast.FastClient({
	    'log': log.child({ 'component': 'FastClient' }),
	    'transport': csock,
	    'nRecentRequests': 100
	});

	csock.on('connect', function () {
		log.info('connected client');
		testcase['run'](log, cclient, function (err) {
			if (err) {
				console.error('test case "%s" FAILED: %s',
				    testcase['name'], err.message);
				console.error(err.stack);
			}

			cclient.detach();
			csock.destroy();
			callback(err);
		});
	});
}

testcases = [ {
    'name': 'basic RPC, no data',
    'run': function (log, fastclient, callback) {
	mod_testcommon.clientMakeRpcCallback(fastclient, {
	    'rpcmethod': 'echo',
	    'rpcargs': [ {
		'values': [],
		'errorResult': false
	    } ]
	}, function (err, data) {
		if (!err && data.length !== 0) {
			err = new VError('expected 0 data items');
		}

		callback(err);
	});
    }

}, {
    'name': 'basic RPC, some data',
    'run': function (log, fastclient, callback) {
	mod_testcommon.clientMakeRpcCallback(fastclient, {
	    'rpcmethod': 'echo',
	    'rpcargs': [ {
		/*
		 * null is not allowed by the protocol, but the old server does
		 * not prevent you from trying to send it
		 */
		'values': [ 'one', 'two', false, true, 7, { 'foo': 'bar' } ],
		'errorResult': false
	    } ]
	}, function (err, data) {
		if (err) {
			callback(err);
			return;
		}

		mod_assertplus.deepEqual(data,
		    [ 'one', 'two', false, true, 7, { 'foo': 'bar' }  ]);
		callback();
	});
    }

}, {
    'name': 'failed RPC, no data',
    'run': function (log, fastclient, callback) {
	mod_testcommon.clientMakeRpcCallback(fastclient, {
	    'rpcmethod': 'echo',
	    'rpcargs': [ {
		'values': [],
		'errorResult': true
	    } ]
	}, function (err, data) {
		if (!err) {
			callback(new Error('expected error'));
			return;
		}

		mod_assertplus.equal(data.length, 0);
		mod_assertplus.equal(err.name, 'FastRequestError');
		err = VError.cause(err);
		mod_assertplus.equal(err.name, 'FastServerError');
		err = VError.cause(err);
		mod_assertplus.equal(err.name, 'Error');
		mod_assertplus.equal(err.message, 'boom boom!');
		mod_assertplus.deepEqual(err.context, { 'result': 'poof' });
		callback();
	});
    }

}, {
    'name': 'failed RPC, some data',
    'run': function (log, fastclient, callback) {
	mod_testcommon.clientMakeRpcCallback(fastclient, {
	    'rpcmethod': 'echo',
	    'rpcargs': [ {
		'values': [ 5, true, 'bob' ],
		'errorResult': true
	    } ]
	}, function (err, data) {
		if (!err) {
			callback(new Error('expected error'));
			return;
		}

		mod_assertplus.deepEqual(data, [ 5, true, 'bob' ]);
		mod_assertplus.equal(err.name, 'FastRequestError');
		err = VError.cause(err);
		mod_assertplus.equal(err.name, 'FastServerError');
		err = VError.cause(err);
		mod_assertplus.equal(err.name, 'Error');
		mod_assertplus.equal(err.message, 'boom boom!');
		mod_assertplus.deepEqual(err.context, { 'result': 'poof' });
		callback();
	});
    }

} ];

main();
