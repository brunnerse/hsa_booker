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



<!-- ![Screenshot of extension](https://i.imgur.com/qs9WI07.png) -->

<br>

# Repository
- **Browser Extension**:  Source code for the browser extension
- **NodeJS_App**: A NodeJS Application doing the same thing as the browser extension, but via an extra website instead of extending the original one.
Not recommended to use, as more experimental and less convenient.


## Browser Extension

- *manifest.json*:
    Extension manifest for chrome-like browsers (uses `manifest_version 3`)

- *manifest_firefox.json*:
    Extension manifest for firefox  (uses `manifest_version 2`)



- *scripts*:
    - *course_modify_page.js*:  Script loaded to course websites, adds the top bar menu and the action buttons to the courses
    - *common.js*:   General functions used by other scripts
    - *common_users.js*:   General functions about handling users 
    - *common_course.js*: General functions about handling courses
    - *course_overview.js*: Loaded on course overview page, highlights courses which have been marked
    - *course.js*: Loaded on any course page, handles marking and unmarking courses, arming etc.
    - *anmeldung.js*:  Loaded on the booking page, handles the autofill of data etc.
    - *popup.js*:  Script for *popup.html*
    - *options.js*: Script for *options.html*
    - *users.js*: Script for *Users.html*
    - *close.js*: Helper script that closes any page it is loaded on
      


<br><br>
---------------

__HSA Booker is in no way affiliated with the Hochschulsport Augsburg.__
