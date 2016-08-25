/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * lib/fast_subr.js: useful utility functions that have not yet been abstracted
 * into separate Node modules.
 */

var mod_assertplus = require('assert-plus');

exports.summarizeSocketAddrs = summarizeSocketAddrs;
exports.IdAllocator = IdAllocator;

/*
 * Given a Node socket, return an object summarizing it for debugging purposes.
 * It's sad how complicated this is.  This is only tested for Node v0.10 and
 * v0.12.
 */
function summarizeSocketAddrs(sock)
{
	var laddr, rv;

	laddr = sock.address();

	if (sock.remoteAddress === undefined &&
	    sock.remotePort === undefined &&
	    sock.remoteFamily === undefined) {
		return ({ 'socketType': 'UDS (inferred)', 'label': 'UDS' });
	}

	rv = {};
	rv['remoteAddress'] = sock.remoteAddress;
	rv['remotePort'] = sock.remotePort;

	if (laddr === null) {
		rv['socketType'] = 'unknown';
		rv['label'] = 'unknown';
	} else {
		rv['socketType'] = laddr.family ? laddr.family : 'unknown';
		rv['localAddress'] = laddr.address;
		rv['localPort'] = laddr.port;

		if (sock.remoteAddress) {
			rv['label'] = sock.remoteAddress;
			if (sock.remotePort) {
				rv['label'] += ':' + sock.remotePort;
			}
		} else {
			rv['label'] = 'unknown';
		}
	}

	return (rv);
}

/*
 * IdAllocator is a cheesy interface for allocating non-negative integer
 * identifiers.  This is similar to the way an OS pid allocator might work,
 * where ids are allocated in increasing order to avoid immediate reuse, but ids
 * eventually will wrap around.  It's expected that callers will use these ids
 * as strings (e.g., as object property names).
 *
 * This is a very simple implementation that we expect to be sufficient for our
 * purposes.  However, it's not very efficient.  We may want to look at
 * something like the Bonwick vmem allocator in the future.
 *
 * This interface considers it a programmer error to attempt to allocate more
 * ids than are currently outstanding (i.e., to attempt to allocate when no
 * resources are available).  That will result in a thrown exception that should
 * not be caught.  If we want to make this survivable in the future, we could
 * improve this, but it's extraordinarily unlikely in the use-cases for which
 * this is intended so it's not worth special-casing at this point.
 *
 * Arguments:
 *
 *     min (number)    minimum allowed id (absolute minimum: 0)
 *
 *     max (number)    maximum allowed id (absolute maximum: 2^31)
 *
 *     isAllocated     function that takes an id and returns whether or not
 *     (function)      the id is still allocated.  This is a obviously  cheesy,
 *		       but given that callers are keeping track of it, we may as
 *		       well just ask them rather than keep a shadow copy of the
 *		       allocated ids.
 *
 */
function IdAllocator(args)
{
	mod_assertplus.object(args, 'args');
	mod_assertplus.number(args.min, 'args.min');
	mod_assertplus.number(args.max, 'args.max');
	mod_assertplus.func(args.isAllocated, 'args.isAllocated');
	mod_assertplus.ok(args.min < args.max, 'min must be less than max');
	mod_assertplus.ok(args.min >= 0, 'min must be non-negative');
	mod_assertplus.ok(args.max <= Math.pow(2, 31), 'max is too big');

	this.ida_min = args.min;
	this.ida_max = args.max;
	this.ida_isalloc = args.isAllocated;
	this.ida_nextid = this.ida_min;
}

IdAllocator.prototype.alloc = function ()
{
	var start, next;

	start = this.ida_nextid;
	next = start;
	while (this.ida_isalloc(next)) {
		next++;

		if (next > this.ida_max) {
			next = this.ida_min;
		}

		if (next == start) {
			throw (new Error('all ids allocated'));
		}
	}

	this.ida_nextid = next + 1;
	if (this.ida_nextid > this.ida_max) {
		this.ida_nextid = this.ida_min;
	}

	return (next);
};
