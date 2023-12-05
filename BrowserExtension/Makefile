TEMPDIR=.hsa_firefox

.PHONY: all

ALL: firefox

firefox: node_hsa.xpi

%.xpi: *.html scripts/* styles/* manifest*
	rm -f $@ 
	mkdir -p $(TEMPDIR) 
	cp -r * $(TEMPDIR) 
	# remove wrongly copied files
	rm -f $(TEMPDIR)/*.zip
	mv $(TEMPDIR)/manifest_firefox.json $(TEMPDIR)/manifest.json
	cd $(TEMPDIR) ;	zip -r ../$@ *
	rm -r $(TEMPDIR)
