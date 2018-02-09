#
# config/javascript/prog.mk
#
# William de Beaumont, wbeaumont@ihmc.us, 2015-04-03
# $Id: prog.mk,v 1.1 2015/04/03 15:46:07 wdebeaum Exp $
#
# The following should be defined before this file is included:
#  MODULE - The name of this TRIPS module
#  MAIN - The main file to run
#  SRCS - The Javascript source files to install (including MAIN)
#

include $(CONFIGDIR)/javascript/common.mk

WRAPPER = $(CONFIGDIR)/javascript/run-javascript-app.sh

# Allow override of default executable name
PROG ?= $(MODULE)

all:: $(PROG)

$(PROG):: $(WRAPPER)
	sed -e 's@TRIPS_BASE_DEFAULT=.*$$@TRIPS_BASE_DEFAULT=$(prefix)@' \
	    -e 's@NODE=.*@NODE=$(NODE)@' \
	    -e 's@MODULE=.*@MODULE=$(MODULE)@' \
	    -e 's@MAIN=.*@MAIN=$(MAIN)@' \
	    $(WRAPPER) >$(PROG)
	chmod a+x $(PROG)

install:: $(PROG)
	$(MKINSTALLDIRS) $(bindir)
	$(INSTALL_PROGRAM) $(PROG) $(bindir)

clean::
	rm -f $(PROG)

run::
	NODE_PATH=..:$(etcdir) $(NODE) $(MAIN) $(ARGV)

