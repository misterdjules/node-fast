/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/tst.server.js: server API test suite
 */

var mod_assertplus = require('assert-plus');
var mod_bunyan = require('bunyan');
var mod_net = require('net');
var mod_path = require('path');
var mod_vasync = require('vasync');

var mod_fast = require('../lib/fast');
var mod_fastdemo = require('../lib/demo_server');
var mod_testcommon = require('./common');

var VError = require('verror');

var testLog;
var serverTestCases;

function main()
{
	testLog = new mod_bunyan({
	    'name': mod_path.basename(__filename),
	    'level': process.env['LOG_LEVEL'] || 'fatal'
	});

	mod_testcommon.registerExitBlocker('test run');

	mod_vasync.forEachPipeline({
	    'inputs': serverTestCases,
	    'func': runTestCase
	}, function (err) {
		if (err) {
			throw (err);
		}

		mod_testcommon.unregisterExitBlocker('test run');
	});
}

function ServerTestContext()
{
	this.ts_log = null;	/* bunyan logger */
	this.ts_socket = null;	/* server net socket */
	this.ts_server = null;	/* fast server object */
	this.ts_clients = [];	/* array of clients, each having properties */
				/* "tsc_socket" and "tsc_client" */
}

ServerTestContext.prototype.connectClient = function (callback)
{
	var ip, port;
	var csock, cclient;
	var self = this;

	ip = mod_testcommon.serverIp;
	port = mod_testcommon.serverPort;
	csock = mod_net.createConnection(port, ip);
	cclient = new mod_fast.FastClient({
	    'log': this.ts_log.child({ 'component': 'FastClient' }),
	    'transport': csock,
	    'nRecentRequests': 100
	});

	csock.on('connect', function () {
		self.ts_clients.push({
		    'tsc_socket': csock,
		    'tsc_client': cclient
		});

		callback();
	});
};

ServerTestContext.prototype.firstFastClient = function ()
{
	mod_assertplus.ok(this.ts_clients.length > 0);
	return (this.ts_clients[0].tsc_client);
};

ServerTestContext.prototype.cleanup = function ()
{
	this.ts_clients.forEach(function (c) {
		c.tsc_client.detach();
		c.tsc_socket.destroy();
	});

	this.ts_socket.close();
	this.ts_server.close();
};

/*
 * XXX move somewhere else?
 */
function clientMakeRpcCallback(fastclient, rpcargs, callback)
{
	var request, data, done;

	mod_assertplus.object(fastclient, 'fastclient');
	mod_assertplus.object(rpcargs, 'rpcargs');
	mod_assertplus.func(callback, 'callback');

	request = fastclient.rpc(rpcargs);

	data = [];
	request.on('data', function (c) { data.push(c); });

	done = false;
	request.on('error', function (err) {
		mod_assertplus.ok(!done);
		done = true;
		callback(err, data);
	});

	request.on('end', function () {
		mod_assertplus.ok(!done);
		done = true;
		callback(null, data);
	});
}

function expectRpcResult(args)
{
	mod_assertplus.object(args, 'args');
	mod_assertplus.optionalObject(args.errorActual, 'args.errorActual');
	mod_assertplus.optionalBool(args.errorExpected, 'args.errorExpected');
	mod_assertplus.arrayOfObject(args.dataActual, 'args.dataActual');
	mod_assertplus.optionalArrayOfObject(
	    args.dataExpected, 'args.dataExpected');

	if (args.errorActual === null && args.errorExpected) {
		return (new VError('expected error, but found none'));
	}

	if (args.errorActual !== null && !args.errorExpected) {
		return (new VError(args.errorActual, 'unexpected error'));
	}

	if (args.dataExpected === null) {
		return (null);
	}

	/* Pretty cheesy. */
	try {
		mod_assertplus.deepEqual(
		    args.dataExpected, args.dataActual);
	} catch (ex) {
		mod_assertplus.equal(ex.name, 'AssertionError');
		return (ex);
	}

	return (null);
}

function unwrapClientRpcError(err)
{
	mod_assertplus.equal(err.name, 'FastRequestError');
	err = VError.cause(err);
	mod_assertplus.equal(err.name, 'FastServerError');
	err = VError.cause(err);
	mod_assertplus.ok(err !== null);
	return (err);
}

function runTestCase(testcase, callback)
{
	var tctx;

	console.error('test case: %s', testcase['name']);

	tctx = new ServerTestContext();
	tctx.ts_log = testLog.child({ 'testcase': testcase['name'] });
	tctx.ts_socket = mod_net.createServer({ 'allowHalfOpen': true });
	tctx.ts_server = new mod_fast.FastServer({
	    'log': tctx.ts_log.child({ 'component': 'FastServer' }),
	    'server': tctx.ts_socket
	});

	mod_fastdemo.demoRpcs().forEach(function (rpc) {
		tctx.ts_server.registerRpcMethod(rpc);
	});

	mod_vasync.pipeline({ 'funcs': [
	    function initServer(_, next) {
		var port = mod_testcommon.serverPort;
		tctx.ts_socket.listen(port, function () {
			tctx.ts_log.debug({ 'port': port }, 'server listening');
			next();
		});
	    },

	    function initClient(_, next) {
		tctx.connectClient(next);
	    },

	    function runTest(_, next) {
		testcase['run'](tctx, next);
	    }
	] }, function (err) {
		tctx.cleanup();
		callback(err);
	});
}

serverTestCases = [ {
    'name': 'basic RPC: no data',
    'run': function (tctx, callback) {
	clientMakeRpcCallback(tctx.firstFastClient(),  {
	    'rpcmethod': 'echo',
	    'rpcargs': []
	}, function (err, data) {
		err = expectRpcResult({
		    'errorActual': err,
		    'errorExpected': null,
		    'dataActual': data,
		    'dataExpected': []
		});

		callback(err);
	});
    }

}, {
    'name': 'basic RPC: 1 data item',
    'run': function (tctx, callback) {
	clientMakeRpcCallback(tctx.firstFastClient(), {
	    'rpcmethod': 'echo',
	    'rpcargs': [ 'lafayette' ]
	}, function (err, data) {
		err = expectRpcResult({
		    'errorActual': err,
		    'errorExpected': null,
		    'dataActual': data,
		    'dataExpected': [ { 'value': 'lafayette' } ]
		});

		callback(err);
	});
    }

}, {
    'name': 'basic RPC: several data items',
    'run': function (tctx, callback) {
	clientMakeRpcCallback(tctx.firstFastClient(), {
	    'rpcmethod': 'echo',
	    'rpcargs': [
	        { 'matches': [ 'tactical', 'brilliance' ] },
		null,
		false,
		17.81
	    ]
	}, function (err, data) {
		err = expectRpcResult({
		    'errorActual': err,
		    'errorExpected': null,
		    'dataActual': data,
		    'dataExpected': [
	                { 'value':
			    { 'matches': [ 'tactical', 'brilliance' ] } },
		        { 'value': null  },
		        { 'value': false },
		        { 'value': 17.81 }
		    ]
		});

		callback(err);
	});
    }

}, {
    'name': 'basic RPC: 0 data items, plus error',
    'run': function (tctx, callback) {
	clientMakeRpcCallback(tctx.firstFastClient(), {
	    'rpcmethod': 'fail',
	    'rpcargs': [ {
		'name': 'MyStupidError',
		'message': 'the server ate my response',
		'info': {
		    'expectedResponse': 'not eaten',
		    'actualResponse': 'eaten'
		},
		'context': {
		    'legacyContextProperty': 'oops'
		}
	    } ]
	}, function (err, data) {
		var rpcerr, info;

		rpcerr = expectRpcResult({
		    'errorActual': err,
		    'errorExpected': true,
		    'dataActual': data,
		    'dataExpected': []
		});

		if (rpcerr) {
			callback(rpcerr);
			return;
		}

		err = unwrapClientRpcError(err);
		mod_assertplus.equal(err.name, 'MyStupidError');
		mod_assertplus.equal(err.message, 'the server ate my response');
		mod_assertplus.equal(err.context.legacyContextProperty, 'oops');

		info = VError.info(err);
		mod_assertplus.equal(info.expectedResponse, 'not eaten');
		mod_assertplus.equal(info.actualResponse, 'eaten');
		callback();
	});
    }

}, {
    'name': 'basic RPC: several data items, plus error',
    'run': function (tctx, callback) {
	clientMakeRpcCallback(tctx.firstFastClient(), {
	    'rpcmethod': 'fail',
	    'rpcargs': [ {
		'data': [ 'one', 'two', 'three' ],
		'name': 'MyStupidError',
		'message': 'the server ate my response',
		'info': {
		    'expectedResponse': 'not eaten',
		    'actualResponse': 'eaten'
		},
		'context': {
		    'legacyContextProperty': 'oops'
		}
	    } ]
	}, function (err, data) {
		var rpcerr, info;

		rpcerr = expectRpcResult({
		    'errorActual': err,
		    'errorExpected': true,
		    'dataActual': data,
		    'dataExpected': null
		});

		if (rpcerr) {
			callback(rpcerr);
			return;
		}

		/*
		 * Any number of data items between 0 and 3 is possible here,
		 * depending on what the server sent out before the request
		 * failed.
		 */
		mod_assertplus.ok(data.length >= 0 && data.length <= 3);
		mod_assertplus.deepEqual(data, [
		    { 'value': 'one' },
		    { 'value': 'two' },
		    { 'value': 'three' }
		].slice(0, data.length));

		err = unwrapClientRpcError(err);
		mod_assertplus.equal(err.name, 'MyStupidError');
		mod_assertplus.equal(err.message, 'the server ate my response');
		mod_assertplus.equal(err.context.legacyContextProperty, 'oops');

		info = VError.info(err);
		mod_assertplus.equal(info.expectedResponse, 'not eaten');
		mod_assertplus.equal(info.actualResponse, 'eaten');
		callback();
	});
    }

}, {
    'name': 'RPC for non-existent method',
    'run': function (tctx, callback) {
	clientMakeRpcCallback(tctx.firstFastClient(), {
	    'rpcmethod': 'badmethod',
	    'rpcargs': []
	}, function (err, data) {
		var rpcerr, info;

		rpcerr = expectRpcResult({
		    'errorActual': err,
		    'errorExpected': true,
		    'dataActual': data,
		    'dataExpected': null
		});

		if (rpcerr) {
			callback(rpcerr);
			return;
		}

		err = unwrapClientRpcError(err);
		mod_assertplus.equal(err.name, 'FastError');
		mod_assertplus.equal(err.message,
		    'unsupported RPC method: "badmethod"');

		info = VError.info(err);
		mod_assertplus.equal(info.fastReason, 'bad_method');
		mod_assertplus.equal(info.rpcMethod, 'badmethod');
		callback();
	});
    }

}, {
    'name': 'multiple RPCs for the same client run in parallel',
    'run': function (tctx, callback) {
	var which = 0;
	var barrier;

	/*
	 * Set up a server where we wait for three RPC calls to show up and then
	 * start completing each of them in order.
	 */
	barrier = mod_vasync.barrier();
	barrier.start('rpc 0');
	barrier.start('rpc 1');
	barrier.start('rpc 2');

	tctx.ts_server.registerRpcMethod({
	    'rpcmethod': 'recordAndReturn',
	    'rpchandler': function fastRpcRecordAndReturn(rpc) {
		var whichrpc = which++;
		barrier.on('drain', function () {
			rpc.end({ 'value': whichrpc });
		});
		barrier.done('rpc ' + whichrpc);
	    }
	});

	mod_vasync.forEachParallel({
	    'inputs': [
	        { 'rpcmethod': 'recordAndReturn', 'rpcargs': [] },
	        { 'rpcmethod': 'recordAndReturn', 'rpcargs': [] },
	        { 'rpcmethod': 'recordAndReturn', 'rpcargs': [] }
	    ],
	    'func': function makeRpc(rpcargs, next) {
		clientMakeRpcCallback(tctx.firstFastClient(), rpcargs, next);
	    }
	}, function (err, results) {
		if (err) {
			throw (err);
		}

		mod_assertplus.deepEqual(results.operations[0].result,
		    [ { 'value': 0 } ]);
		mod_assertplus.deepEqual(results.operations[1].result,
		    [ { 'value': 1 } ]);
		mod_assertplus.deepEqual(results.operations[2].result,
		    [ { 'value': 2 } ]);

		callback();
	});
    }

/*
 * More test cases:
 * - invalid message sent by client (e.g., protocol error), no other RPCs
 *   pending
 * - invalid message sent by client (e.g., protocol error), with other RPCs
 *   pending
 * - unexpected end-of-stream from client while request is outstanding
 * - socket error from client while request is outstanding
 * - non-'data' message sent by client
 * - sending large number of data messages back
 * - flow control?
 */
} ];

main();
