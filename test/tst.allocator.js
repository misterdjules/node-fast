/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/tst.allocator.js: tests our cheesy IdAllocator
 */

var mod_assertplus = require('assert-plus');
var mod_subr = require('../lib/subr');

var allocator, isAllocated, nQueries;

console.log('test cases: bad arguments');
mod_assertplus.throws(function () {
	allocator = mod_subr.IdAllocator({});
}, /args\.min \(number\) is required/);

mod_assertplus.throws(function () {
	allocator = mod_subr.IdAllocator({ 'min': 7 });
}, /args\.max \(number\) is required/);

mod_assertplus.throws(function () {
	allocator = mod_subr.IdAllocator({ 'min': 7, 'max': 15 });
}, /args\.isAllocated \(func\) is required/);

mod_assertplus.throws(function () {
	allocator = mod_subr.IdAllocator({ 'min': 18, 'max': 15,
	    'isAllocated': function () {} });
}, /min must be less than max/);

mod_assertplus.throws(function () {
	allocator = mod_subr.IdAllocator({ 'min': -1, 'max': 15,
	    'isAllocated': function () {} });
}, /min must be non-negative/);

mod_assertplus.throws(function () {
	allocator = mod_subr.IdAllocator({ 'min': 0, 'max': Math.pow(2, 37),
	    'isAllocated': function () {} });
}, /max is too big/);


console.log('test cases: basic allocator wraps around');
isAllocated = {};
nQueries = 0;
allocator = new mod_subr.IdAllocator({
    'min': 0,
    'max': 7,
    'isAllocated': function (id) {
	nQueries++;
    	return (isAllocated[id]);
    }
});

/*
 * For the first round, we're going to continue acting like nothing is allocated
 * to make sure that we wrap around the id space.
 */
mod_assertplus.equal(allocator.alloc(), 0);
mod_assertplus.equal(nQueries, 1);
mod_assertplus.equal(allocator.alloc(), 1);
mod_assertplus.equal(nQueries, 2);
mod_assertplus.equal(allocator.alloc(), 2);
mod_assertplus.equal(nQueries, 3);
mod_assertplus.equal(allocator.alloc(), 3);
mod_assertplus.equal(allocator.alloc(), 4);
mod_assertplus.equal(allocator.alloc(), 5);
mod_assertplus.equal(allocator.alloc(), 6);
mod_assertplus.equal(allocator.alloc(), 7);
mod_assertplus.equal(nQueries, 8);

/*
 * Again, since we're pretending like nothing is allocated, the next round
 * should wrap around again as normal.
 */
mod_assertplus.equal(allocator.alloc(), 0);
mod_assertplus.equal(nQueries, 9);
mod_assertplus.equal(allocator.alloc(), 1);
mod_assertplus.equal(allocator.alloc(), 2);
mod_assertplus.equal(allocator.alloc(), 3);
mod_assertplus.equal(allocator.alloc(), 4);
mod_assertplus.equal(allocator.alloc(), 5);
mod_assertplus.equal(allocator.alloc(), 6);
mod_assertplus.equal(allocator.alloc(), 7);
mod_assertplus.equal(allocator.alloc(), 0);
mod_assertplus.equal(allocator.alloc(), 1);
mod_assertplus.equal(nQueries, 18);

/*
 * Now let's pretend like the next several are allocated.  Those should be
 * skipped, and we should get "5" after asking four questions.
 */
console.log('test cases: allocator skips allocated ids');
isAllocated[2] = true;
isAllocated[3] = true;
isAllocated[4] = true;
mod_assertplus.equal(allocator.alloc(), 5);
mod_assertplus.equal(nQueries, 22);


console.log('test cases: allocator fails if everything is allocated');
isAllocated[0] = true;
isAllocated[1] = true;
isAllocated[5] = true;
isAllocated[6] = true;
isAllocated[7] = true;
mod_assertplus.throws(function () { allocator.alloc(); },
    /all ids allocated/);
mod_assertplus.equal(nQueries, 30);

console.log('tst.allocator.js tests passed');
