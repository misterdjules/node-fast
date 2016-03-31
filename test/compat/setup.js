/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2016, Joyent, Inc.
 */

/*
 * test/compat/setup.js: command-line tool for setting up a local repository for
 * running compatibility tests.  This is responsible for installing the legacy
 * node-fast package, which requires using a copy of Node 0.10 (while the rest
 * of this repo uses 0.12 or later).
 */

var mod_assertplus = require('assert-plus');
var mod_child = require('child_process');
var mod_cmdutil = require('cmdutil');
var mod_fs = require('fs');
var mod_vasync = require('vasync');

var mod_compat = require('./common');

/*
 * We test against the Fast server that's widely deployed in Moray, which is
 * 0.3.1.
 */
var FAST_MODULE_NAME = 'fast';
var FAST_MODULE_VERSION = '0.3.1';

function main()
{
	var npmbin;
	var pkgtoinstall = FAST_MODULE_NAME + '@' + FAST_MODULE_VERSION;

	mod_vasync.waterfall([
	    function loadConfig(next) {
		mod_compat.nodeConfigLoad(next);
	    },

	    function workaroundNpmMisdesign(nodeconfig, next) {
		mod_assertplus.object(nodeconfig);
		mod_assertplus.string(nodeconfig.nodebin);
		mod_assertplus.string(nodeconfig.npmbin);
		npmbin = nodeconfig.npmbin;

		/*
		 * Contrary to popular belief, npm does not necessarily install
		 * non-global packages into the current directory.  If there's
		 * no node_modules or package.json there, it walks up to the
		 * nearest parent directory that has one "even if you happen to
		 * have cd'ed into some other folder".  That's decidedly not
		 * what we want here, but we can trick it by creating our own
		 * node_modules directory here.  Of course, if it already
		 * exists, we should do nothing.
		 */
		mod_fs.mkdir('node_modules', function (err) {
			if (err && err['code'] == 'EEXIST') {
				err = null;
			}

			next(err);
		});
	     },

	     function installOldModule(next) {
		process.stderr.write('installing legacy fast version ' +
		    pkgtoinstall + ' ... ');
		mod_child.execFile(npmbin, [ 'install', pkgtoinstall ],
		    function (err, stdout, stderr) {
			err = mod_compat.makeExecError(
			    npmbin + ' install ' + pkgtoinstall,
			    err, stdout, stderr);
			if (err) {
				process.stderr.write('FAIL\n');
				next(err);
				return;
			}

			process.stderr.write('done.\n');
			next();
	             });
	     }
	], function (err) {
		if (err) {
			mod_cmdutil.fail(err);
		}

		console.log('setup for compatibility tests');
	});
}

main();
