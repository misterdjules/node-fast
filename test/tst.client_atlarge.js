/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/tst.client_atlarge.js: client API at-large test suite
 *
 * This file contains a test runner (runTestCase) that executes fairly free-form
 * test cases against the client API.  Most client API test cases can be fit
 * into the much simpler model in tst.client_request.js, and we should generally
 * put test cases in there when possible.  The test cases that need to go here
 * include those where the end of the test is harder to identify.
 *
 * XXX Test cases that should go here:
 * - next: generate an extra 'end' message
 * - next: generate an extra 'error' message
 * - next: generate an extra 'error' message after previous 'end'
 * - next: generate an extra 'end' message after previous 'error'
 * - next: server generates completely unsolicited message
 * - next: client abort, in various states
 * - next: generate end-of-stream with no requests outstanding
 * - next: generate a socket error on the client with no requests outstanding
 * - next: generate a socket error on the client with N > 1 requests outstanding
 * - next: respond to 10,000 requests in series, some with errors
 */

throw (new Error('not yet implemented'));
