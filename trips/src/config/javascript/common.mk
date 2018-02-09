#
# config/javascript/common.mk
#
# William de Beaumont, wbeaumont@ihmc.us, 2015-04-03
# $Id: common.mk,v 1.1 2015/04/03 15:46:06 wdebeaum Exp $
#
# The following should be defined before this file is included:
#  MODULE - The name of this TRIPS module
#  SRCS - The Javascript source files to install
#  REQUIRES - Modules to install using npm
#

include $(CONFIGDIR)/version.mk
include $(CONFIGDIR)/defs.mk
include $(CONFIGDIR)/javascript/defs.mk

all default::

clean::

$(etcdir)/node_modules/%:
	$(MKINSTALLDIRS) $(etcdir)
	cd $(etcdir); $(NPM) install $*

REQUIRES_DIRS=$(REQUIRES:%=$(etcdir)/node_modules/%)

install:: $(REQUIRES_DIRS)
	$(MKINSTALLDIRS) $(etcdir)/$(MODULE)
	$(INSTALL_DATA) $(SRCS) $(etcdir)/$(MODULE)

