# HSA Booker

HSA Booker is an extension for the website of the [Hochschulsport Augsburg](https://hsa.sport.uni-augsburg.de).
When booking a course, the extension can automatically fill out all user data in the booking form and submit the form, thereby helping the user save time during the booking process.  
The add-on also allows marking individual courses. When an "Arm"-button on the website is pressed, the add-on will refresh the site until the course becomes bookable, at which point the add-on will automatically book the course.



## Installation for different browsers
### Firefox
Install from **[Addon page](https://addons.mozilla.org/de/firefox/addon/hsa-booker/)**

### Chrome-based (Chrome, Chromium, Edge, ...)
(Not an official addon as the chrome web store wants money)  
Install as unpacked extension:  
- Download the folder **Browser Extension** (which contains the source code) and extract it to a chosen location  
- In your browser, go to **[Extensions](chrome://extensions)**. 
- Enable the Developer mode in the top right corner. 
- Click on "Load unpacked extension" in the top left
- Select the directory you extracted the source code to and confirm.  
- The Developer mode can now be disabled again in the top right corner.


__HSA Booker is in no way affiliated with the Hochschulsport Augsburg.__

<!-- ![Screenshot of extension](https://i.imgur.com/qs9WI07.png) -->


# Repository
- **Browser Extension**:  Source code for the browser extension
- **NodeJS_App**: A NodeJS Application doing the same thing as the browser extension, but via an extra website instead of extending the original one.
Not recommended to use, as more experimental and less convenient. 