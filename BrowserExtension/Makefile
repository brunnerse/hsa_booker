SHELL=/bin/bash -O extglob -c

TEMPDIR=hsa_zip
SRCS=$(wildcard *.html scripts/* styles/* img/*)

.PHONY: all

ALL: hsa_booker.xpi hsa_booker.crx
	rm -r $(TEMPDIR)

firefox: hsa_booker.xpi 
	rm -r $(TEMPDIR)
chrome: hsa_booker.crx 
	rm -r $(TEMPDIR)

$(TEMPDIR): $(SRCS)
	mkdir -p $@	
	cp -r !(*.crx|*.zip|*.xpi|Makefile|manifest*|$@) $@ 

%.xpi: manifest_firefox.json $(TEMPDIR) 
	rm -f $@
	cp $< $(TEMPDIR)/manifest.json
	cd $(TEMPDIR); zip -r ../$@ * > /dev/null 

%.crx: manifest.json $(TEMPDIR)
	rm -f $@
	cp $< $(TEMPDIR)/manifest.json 
	cd $(TEMPDIR); zip -r ../$@ *
