TEMPDIR=.hsa_firefox

firefox:
	rm -f hsa_firefox.zip
	mkdir -p $(TEMPDIR) 
	cp -r * $(TEMPDIR) 
	# remove wrongly copied files
	rm -f $(TEMPDIR)/*.zip
	mv $(TEMPDIR)/manifest_firefox.json $(TEMPDIR)/manifest.json
	cd $(TEMPDIR) ;	zip -r ../hsa_firefox.zip *
	rm -r $(TEMPDIR)
