REQUIRES=mocha
CONFIGDIR=../../config

all default::

install::
	$(error "Nothing to install here.")

include $(CONFIGDIR)/javascript/common.mk

all default:: $(REQUIRES_DIRS)
	env TRIPS_BASE=$(prefix) NODE_PATH=../:../../:$(etcdir)/node_modules $(etcdir)/node_modules/mocha/bin/mocha *.js

# rules for running specific test files
test-%:
	env TRIPS_BASE=$(prefix) NODE_PATH=../:../../:$(etcdir)/node_modules $(etcdir)/node_modules/mocha/bin/mocha $*.js

