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
exports.summarizeSocketAddrs = summarizeSocketAddrs;

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
