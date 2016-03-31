# Contributing to node-fast2

Changes must be `make prepush` clean.  In general, it's a good idea to file an
issue before starting work in order to reach consensus on a proposed change.
The appropriate test plan will depend on the nature of the change.  Because this
protocol is widely deployed, we generally view backwards compatibility (both on
the wire and in the API) as a constraint on all changes.


## Testing

Automated tests can be run using `make test`.  This test suite should be pretty
exhaustive for both basic functionality and edge cases.

You can use the `fastserve` and `fastcall` programs for ad-hoc testing.


## Backwards compatibility with older versions of Fast

As mentioned in the README, there was a previous implementation of this
protocol.  The client and server APIs are different in this module than the
previous implementation.  However, the client here is compatible with a server
built on the previous implementation, and the server here is compatible with a
client built on the previous implementation.

There are several reasons we might want to use the old implementation in this
module:

* done: basic functionality testing this client against the old server
* not yet implemented: basic functionality testing this server against the old
  client
* not yet implemented: for performance testing either the old client or server

This is made significantly more complicated by the fact that the old
implementation only works with Node 0.10, while this implementation is expected
to run on Node 0.12 and later.

**The easiest way to test compatibility is to set `FAST\_COMPAT\_NODEDIR` in
your environment and run `make test-compat`**:

    export FAST_COMPAT_NODEDIR=/path/to/node-v0.10-directory
    make test-compat

This will do the following:

* sanity-check the `node` in `$FAST_COMPAT_NODEDIR/bin/node`
* use the `npm` in that directory to install the _old_ fast module into
  `test/compat/node_modules/fast`
* run the compatibility tests in `test/compat`.

These could be incorporated into "make prepush", but developers would have to
have `FAST_COMPAT_NODEDIR` set to a directory containing 0.10.
