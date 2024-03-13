SHELL=bash -O extglob -c

TEMPDIR=hsa_zip
SRCS=$(wildcard *.html scripts/* styles/* img/*)

.PHONY: all

all: hsa_booker.xpi #hsa_booker.crx
	rm -r $(TEMPDIR)
	$(info Packaged extension to $^.)

firefox: hsa_booker.xpi 
	rm -r $(TEMPDIR)
	$(info Packaged extension to $^.)

chrome: hsa_booker.crx 
	rm -r $(TEMPDIR)
	$(info Packaged extension to $^.)


$(TEMPDIR): $(SRCS)
	mkdir -p $@	
	cp -r !(*.crx|*.zip|*.xpi|Makefile|manifest*|$@) $@ 

%.xpi: manifest_firefox.json $(TEMPDIR) 
	rm -f $@
	cp $< $(TEMPDIR)/manifest.json
	cd $(TEMPDIR); zip -r ../$@ *

%.crx: manifest.json $(TEMPDIR)
	rm -f $@
	cp $< $(TEMPDIR)/manifest.json 
	cd $(TEMPDIR); zip -r ../$@ *
