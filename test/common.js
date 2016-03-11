/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/common.js: common utilities for test suite
 */

var mod_assertplus = require('assert-plus');
var mod_crc = require('crc');
var mod_protocol = require('../lib/fast_protocol');

exports.makeBigObject = makeBigObject;
exports.writeMessageForEncodedData = writeMessageForEncodedData;

/*
 * Construct a plain-old-JavaScript object whose size is linear in "width" and
 * exponential in "depth".
 */
function makeBigObject(width, depth)
{
	var i, rv;

	mod_assertplus.number(width);
	mod_assertplus.number(depth);
	mod_assertplus.ok(depth >= 1);

	rv = {};
	if (depth === 1) {
		for (i = 0; i < width; i++) {
			rv['prop_1_' + i] = 'prop_1_' + i + '_value';
		}
	} else {
		for (i = 0; i < width; i++) {
			rv['prop_' + depth + '_' + i] =
			    makeBigObject(width, depth - 1);
		}
	}

	return (rv);
}

/*
 * Writes into "buf" (a Node buffer) at offset "msgoffset" a Fast packet with
 * message id "msgid", status byte "status", encoded data "dataenc".  This is
 * used to generate *invalid* messages for testing purposes.  If you want to
 * generate valid Fast messages, see the MessageEncoder class.
 */
function writeMessageForEncodedData(buf, msgid, status, dataenc, msgoffset)
{
	var crc, datalen;
	crc = mod_crc.crc16(dataenc);
	datalen = Buffer.byteLength(dataenc);

	buf.writeUInt8(mod_protocol.FP_VERSION_1,
	    msgoffset + mod_protocol.FP_OFF_VERSION);
	buf.writeUInt8(mod_protocol.FP_TYPE_JSON,
	    msgoffset + mod_protocol.FP_OFF_TYPE);
	buf.writeUInt8(status, msgoffset + mod_protocol.FP_OFF_STATUS);
	buf.writeUInt32BE(msgid, msgoffset + mod_protocol.FP_OFF_MSGID);
	buf.writeUInt32BE(crc, msgoffset + mod_protocol.FP_OFF_CRC);
	buf.writeUInt32BE(datalen, msgoffset + mod_protocol.FP_OFF_DATALEN);
	buf.write(dataenc, msgoffset + mod_protocol.FP_OFF_DATA);
}
