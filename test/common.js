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

exports.makeBigObject = makeBigObject;

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
