# Makefile for Spaceman TRIPS module for toponym resolution/spatial set ops

MODULE=Spaceman
MAIN=$(MODULE).js
SRCS=$(MAIN) set-ops.js

CONFIGDIR=trips/src/config
include $(CONFIGDIR)/javascript/prog.mk

INSTALL_DIR=$(etcdir)/$(MODULE)

# this rule added for standalone git version
install::
	cd trips/src/KQML && make install
	cd trips/src/TripsModule && make install
	cd trips/src/util/cwc && make install

install:: $(INSTALL_DIR)/cty/map.shp $(INSTALL_DIR)/fpu/map.shp downloads/countries.json
	$(MKINSTALLDIRS) $(INSTALL_DIR)/cache/impact
	$(MKINSTALLDIRS) $(INSTALL_DIR)/cache/osm
	$(MKINSTALLDIRS) $(INSTALL_DIR)/cache/computed
	$(INSTALL_DATA) downloads/countries.json $(INSTALL_DIR)

downloads/MADE:
	mkdir -p downloads
	touch $@

downloads/cty.zip: downloads/MADE
	curl -L -o $@ "https://www.dropbox.com/sh/d8rgc0eha51wtxj/AAAkXOh_zesTqegJ5gzLvDGXa/InputFiles/Scenarios/cty?dl=1"

downloads/fpu.zip: downloads/MADE
	curl -L -o $@ "https://www.dropbox.com/sh/d8rgc0eha51wtxj/AACCbKMkA-WBUpKWphDAQGD0a/InputFiles/Scenarios/fpu?dl=1"

downloads/countries.json: downloads/MADE
	curl -L -o $@ "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"

$(INSTALL_DIR)/cty/map.shp: downloads/cty.zip
	rm -rf $(dir $@)
	mkdir $(dir $@)
	unzip $< -x / -d $(dir $@)

$(INSTALL_DIR)/fpu/map.shp: downloads/fpu.zip
	rm -rf $(dir $@)
	mkdir $(dir $@)
	unzip $< -x / -d $(dir $@)

clean-cache clear-cache:
	rm -rf	$(INSTALL_DIR)/cache/impact/* \
		$(INSTALL_DIR)/cache/osm/* \
		$(INSTALL_DIR)/cache/computed/* \
		$(INSTALL_DIR)/cache/WD-*

test::
	cd tests ; $(MAKE)

test-%::
	cd tests ; $(MAKE) $@
