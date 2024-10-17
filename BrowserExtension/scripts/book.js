let form = document.forms[0];
let submitElem = document.getElementById("bs_submit");

const loadTime = Date.now();

let lastTimestamp;

let userdata = {};

const STATES = ["fill", "check", "confirmed", "error"];

let STATE;

async function setBookingMessage(message, color="black") {
    console.assert(submitElem);
    // get message element or create it if it doesnt exist yet
    let messageElem = document.getElementById("bookingmessage");
    if (message == "") {
        if (messageElem)
            submitElem.parentElement.removeChild(messageElem);
        return;
    }
    if (!messageElem) {
        messageElem = document.createElement("DIV");
        messageElem.className = "bs_form_row";
        messageElem.id = "bookingmessage";
        submitElem.parentElement.insertBefore(messageElem, submitElem);
    }
    messageElem.setAttribute("style", `text-align:center;font-weight:bold;color:${color};background-color:none;`);
    messageElem.innerText =  message;
}

let countdownId; 
function startCountdownMsg() {
    if (countdownId)
        clearInterval(countdownId);
    let msgElem = document.getElementById("countdownmessage");
    if (!msgElem)  {
        msgElem = document.createElement("DIV");
        msgElem.id = "countdownmessage";
        msgElem.setAttribute("style", 
            "background-color:#F1F1E3;color:green;font-size: 12pt; font-weight:bold;text-align:center;padding:8px;")
        let parent = document.getElementById("bs_form_head");
        if (!parent)
            return; // error: element bs_ag not found
        parent.insertBefore(msgElem, parent.children[1]);
        let spaceDiv = document.createElement("div");
        spaceDiv.className = "bs_space";
        spaceDiv.setAttribute("style", "margin: 0");
        parent.insertBefore(spaceDiv, msgElem);
    }
    let counterElem = document.getElementById("bs_counter");
    if (!counterElem)
        return;
    countdownId = setInterval(() => {
        let duration = parseFloat(counterElem.innerText.replaceAll(".", " "));
        if (!isNaN(duration)) {
            duration = (duration-1) / 3.0;
            msgElem.innerText = "HSA Booker: Automatically submitting in " + duration.toFixed(1) + " ...";
        } else {
            msgElem.innerText = "HSA Booker: Automatically submitting after countdown..."
        }
    }, 333); 

} 

function stopCountdownMsg() {
    clearInterval(countdownId);
    let msgElem = document.getElementById("countdownmessage");
    if (msgElem)
        msgElem.remove();
} 


async function bypassCountdown() {
    // Listener for onsubmit event does not let form submit until countdown is done 
    // -> Replace whole form with itself while removing the listener
    // Slight problem:  Listener also performs form checking, so this is disabled too
    let newForm = form.cloneNode(true);
    newForm.removeAttribute("data-onsubmit");
    // Replace whole form
    form.replaceWith(newForm);
    form = document.forms[0]; 
    submitElem = document.getElementById("bs_submit");
    console.assert(submitElem);
    submitElem.className = "sub";
}

async function onSelectChange() {
    let selectedUser = getSelected(userSelectElem); 
    if (selectedUser == "") {
        clearForm(); 
    } else {
        let data = userdata[selectedUser];
        fillForm(form, data);
    }
}

function fillForm(form, data) {
    // Set status select option
    let selectElem = form.querySelector("select[name='statusorig']");
    console.assert(selectElem);

    for (let i = 0; i < selectElem.options.length; i++) {
        if (selectElem.options[i].value == data["statusorig"]) {
            selectElem.selectedIndex = i;
            selectElem.dispatchEvent(new Event("change"));
            break;
        }
    }

    removeWarnMarks();
    // Set form input elements
    let inputElems = form.getElementsByTagName("INPUT");
    for (let inputElem of inputElems) {
        if (inputElem.getAttribute("disabled") == "disabled")
            continue;
        // set radio button checked
        if (inputElem.type == "radio" && data[inputElem.name])
            inputElem.checked = (inputElem.value == data[inputElem.name]); 
        // set accept conditions button
        else if (inputElem.name == "tnbed")
            inputElem.checked = true;
        else if (inputElem.name.startsWith("pw_")) // Clear password fields
            inputElem.value = "";
        else if (data[inputElem.name])
            inputElem.value = data[inputElem.name];
   }
}

function removeWarnMarks() {
    let inputElems = form.getElementsByTagName("INPUT");
    for (let e of inputElems) {
        let g = e.closest(".bs_form_row");
        g && g.classList.remove("warn");
    }
}


async function clearForm() {
    removeWarnMarks();
    let form = document.getElementById("bs_form_main");
    let inputElems = form ? form.getElementsByTagName("INPUT") : [];
    for (let inputElem of inputElems) {
        // uncheck sex radio buttons
        if (inputElem.type == "radio")
            inputElem.checked = false; 
        else {
            // clear form data
            inputElem.value = ""; 
        }
    }
    let selectElem = form.getElementsByTagName("SELECT")[0];
    if (selectElem) {
        selectElem.selectedIndex = 0;
        selectElem.dispatchEvent(new Event("change"));
    }
}


function getCourseID(docState) {
    let nr, date;

    if (docState == "fill" || docState == "check" || docState == "error") {
        for (let elem of document.querySelectorAll(".bs_form_sp2 *")) {
            let nrMatch = elem.innerText.match(/^\d+$/); 
            let dateMatch = elem.innerText.match(/^(\d+\.){2}\d*/);
            if (!nr && nrMatch)
                nr = nrMatch[0];
            if (!date && dateMatch)
                date = getFullDateStr(dateMatch[0]);
            if (nr && date)
                break;
        }
    } else if (docState == "confirmed") {
        for (let elem of document.querySelectorAll("td")) {
            let nrMatch = elem.innerText.match(/^\d+-\d+$/); 
            let dateMatch = elem.innerText.match(/^(\d+\.){2}\d*/);
            if (!nr && nrMatch)
                nr = nrMatch[0].match(/^\d+/)[0];
            if (!date && dateMatch)
                date = getFullDateStr(dateMatch[0]);
            if (nr && date)
                break;
        }
    }
    if (nr && date) 
        return nr+"_"+date;
    console.error("Could not find number or date for course.\tNr:" + nr + ", Date:" + date);
    return null;
}

// resets the booking state if window is refreshed/closed 
function removeBookingStateOnClose(courseID) {
    window.addEventListener("beforeunload", function (e) {
        removeBookingState(courseID, /*local=*/true);
    }); 
}

async function processDocument() {
    // Check which state the site is in by checking the form in the document
    let nameInput;
    if (form) {
        for (let input of form.getElementsByTagName("INPUT")) {
            if (input["name"] == "vorname") {
                nameInput = input;
                break;
            }
        }
    }
    STATE = "error";
    if (!nameInput) {
        if (document.title == "Bestätigung")
            STATE = "confirmed"
    } else if (nameInput.type == "hidden") {
        STATE = "check";
    } else if (nameInput.type == "text") {
        STATE = "fill";
    }

    userdata = await download(USERS_FILE) ?? {};
    const courseID = getCourseID(STATE);
    const user = Object.keys(userdata).length > 0 ? Object.keys(userdata)[0] : null;

    console.log(`Booking site is in state "${STATE}", course is ${courseID}, user is "${user}"` );

    if (STATE == "fill") {
        console.assert(submitElem);
        // If did not find user or courseID, we cannot do anything
        if (!user)
            return;
        if (!courseID) {
            if (userdata[user] && await getOption("fillform")) {
                fillForm(form, userdata[user]);
                setBookingMessage("HSA Booker: Something went wrong, please submit manually", "darkorange");
            } 
            return;
        }


        // If form has a marked error, give message and do nothing (use query selector as it stops once it finds the first element)
        if (form.querySelector(".warn")) {
            setBookingMessage("Submit failed due to form error. Check the form and submit again manually.", "red");
            // Set booking state perodically, then return
            setInterval(() => setBookingState(courseID, "booking", /*local=*/true), booking_expiry_msec * 0.4);
            removeBookingStateOnClose(courseID);
            return;
        }

        // set booking state
        let prevBookingState = await getBookingState(courseID); 
        if (prevBookingState == "booked") {
            console.warn("COURSE IS ALREADY MARKED AS BOOKED")
            setBookingMessage("ALERT: COURSE IS ALREADY MARKED AS BOOKED", "red");
            document.title = document.title + " - ALREADY BOOKED";
            // Fill out form anyway, but return immediately afterwards 
            if (userdata[user] && await getOption("fillform"))
                fillForm(form, userdata[user]);
            return;
        } else if (prevBookingState == "booking") {
            setBookingMessage("COURSE IS ALREADY BEING BOOKED, CLOSING...", "red");
            sleep(1000).then(window.close);
            return;
        } else if (prevBookingState) {
            // if state was e.g. error, remove the state
            await removeBookingState(courseID, /*local=*/false);
        }
        
        lastTimestamp = await setBookingState(courseID, "booking", /*local=*/true);

        removeBookingStateOnClose(courseID);
        setInterval(async () => {
            // check if the last timestamp is the own one;
            // if not, another tab is writing and we should abort booking
            let bookState = await getBookingState(courseID, /*includeTimestamp=*/true, /*localOnly=*/true); 
            if (!bookState)
                console.error("Booking state somehow did not get stored; maybe it expired before reading?");
            else {
                let [state, stamp] = bookState;
                if (state == "booking" && stamp != lastTimestamp) {
                    setBookingMessage("COURSE IS BEING BOOKED BY ANOTHER TAB, CLOSING...", "red");
                    await sleep(1000);
                    window.close();
                    return;
                }
            }
            // update booking state timestamp constantly to show the site did not timeout
            lastTimestamp = await setBookingState(courseID, "booking", /*local=*/true);
        }, booking_expiry_msec * 0.4);

        if (await getOption("bypasscountdown")) {
            bypassCountdown();
        }


        if (userdata[user] && await getOption("fillform")) {

            fillForm(form, userdata[user]);

            // Sometimes password fields are automatically set by browser autofill;
            // Wait a few seconds for autofill, then reset their value
            sleep(4000).then(() => {
                for (let inputElem of form.getElementsByTagName("INPUT")) {
                    if (inputElem.name.startsWith("pw_")) {
                        inputElem.value = "";
                    }
                }
            });

            if (await getOption("submitimmediately")) {
                // insert message that form will be submitted
                startCountdownMsg();
                setBookingMessage("Submitting once the countdown is done...", "green");

                let submitImm = true;
                // Check if user disables submitimmediately option
                let listener = (changes) => {
                    for (let item of Object.keys(changes)) {
                        if (item == OPTIONS_FILE && !changes[item].newValue["submitimmediately"]) {
                            submitImm = false;
                            setBookingMessage("Aborted automatic submit.", "darkorange");
                            stopCountdownMsg();
                            sleep(1000).then(() => setBookingMessage("", "white"));
                            removeStorageListener(listener);
                        } 
                    }
                };
                addStorageListener(listener);

                // wait until countdown passed
                while(submitElem.className != "sub") {
                    // check if aborted
                    if (!submitImm)
                        break;
                    // if 8 seconds have passed but submitElem is still not enabled, bypass the countdown 
                    // This happens when javascript slows down because the tab is in the background
                    if (Date.now() - loadTime >= 8000) {
                        setBookingMessage("Activating bypass...", "darkorange");
                        bypassCountdown();
                        // fill form again 
                        userdata[user] && fillForm(form, userdata[user]);
                        break;
                    }
                    await sleep(50);       
                }
                // check again if submitimmediately option is set, then submit
                if (submitImm) {
                    form.requestSubmit(submitElem);
                    setBookingMessage("Submitting...", "green");
                    // Display error if submit did not work after some time 
                    sleep(1500)
                    .then(() => setBookingMessage("Automatic submit failed. Check the form and submit again manually.", "red"))
                    .then(() => submitElem.focus())
                    .then(stopCountdownMsg);
                }
            } 
        } else {
            let listener = (changes) => {
                for (let item of Object.keys(changes)) {
                    if (item == OPTIONS_FILE && changes[item].newValue["fillform"] && userdata[user]) {
                        fillForm(form, userdata[user]);
                        removeStorageListener(listener);
                    } 
                }
            };
            addStorageListener(listener);
        }
    } else if (STATE == "check") {

        if (user && courseID) {
            // Do not check if state is booked; if this page (check) is reached, user already decided to ignore it
            setBookingState(courseID, "booking", /*local=*/true);
            removeBookingStateOnClose(courseID);

            // update booking state timestamp constantly to show the site did not timeout
            setInterval(()=> {
                setBookingState(courseID, "booking", /*local=*/true);
                }, booking_expiry_msec * 0.4);
        }

        let inputElems = form.getElementsByTagName("INPUT");
        // Get email from form
        let emailVal = "";
        for (let inputElem of inputElems) {
            if (inputElem.name == "email") {
                emailVal = inputElem.value;
                break;
            }
        }
        // find submit button and enter email again in check field
        let submitButton; 
        for (let inputElem of inputElems) {
            if (inputElem.title == "fee-based order") {
                submitButton = inputElem;
            } else if (inputElem.name.startsWith("email_check") && emailVal) {
                inputElem.value = emailVal;  
            } else if (inputElem.name.startsWith("pw") && userdata[user] && userdata[user]["pw"]) {
                inputElem.value = userdata[user]["pw"];
            }
        }

        submitButton && setTimeout(() => submitButton.focus(), 100);

        let isUserActionRequired = false; 

        // Check if form has a marked error (use query selector as it stops once it finds the first element)
        if (form.querySelector(".warn"))
            isUserActionRequired = true;

        // Check if user still has to enter something
        for (let enElem of document.getElementsByClassName("bs_form_entext")) {
            // Check if text says to enter something (other than the email, which is entered automatically)
            if (enElem.innerText.match(/[Ee]nter\s/) && !enElem.innerText.match(/\b[Ee][-\s]*mail/)) {
                isUserActionRequired = true;
                console.log("User action required for: ", enElem.innerText);
                let rowElem = enElem.closest(".bs_form_row,.bs_form_infotext");
                if (rowElem) {
                    rowElem.classList.add("warn");
                    setTimeout(() => rowElem.focus(), 100);
                }
            }
        }
        if (isUserActionRequired) {
            // Change the tab title continuously to draw user attention to the tab
            titleChangeFun = async () => {
                const appstr = "[USER ACTION REQUIRED] ";
                if (document.title.startsWith(appstr))
                    document.title = document.title.substring(appstr.length);
                else
                    document.title = appstr + document.title;
            }
            for (let i = 0; i < 11; i++)
                await titleChangeFun().then(() => sleep(333));
        }

        if (!isUserActionRequired && await getOption("submitimmediately"))  {
            // submit
            console.assert(submitButton);
            //submitButton.setAttribute("inert", "");
            form.requestSubmit(submitButton); 
        } else {
            // Do nothing
            // submitButton.setAttribute("inert", "");
        }
    } else if (STATE == "confirmed") {
        // signalize success by setting the global booking state
        if (user && courseID) {
            console.log(`Course Nr. ${courseID.split("_").join(" starting on ")} has been successfully booked.`);
            await removeBookingState(courseID, /*local=*/true);
            await setBookingState(courseID, "booked", /*local=*/false);
        }
    } else {
        console.log("An error occured during booking.");

        // Constantly set bookingstate "error" until another tab sets another booking state
        if (user && courseID && (await getBookingState(courseID, false, false, /*syncOnly=*/true) != "booked")) {
            await removeBookingState(courseID, /*local=*/true);
            let lastTimestamp = await setBookingState(courseID, "error", /*local=*/true);
            removeBookingStateOnClose(courseID);
            setInterval(async () => {
                // check if the last timestamp is the own one;
                // if not, another tab is writing and we should abort
                let bookState = await getBookingState(courseID, /*includeTimestamp=*/true, /*localOnly=*/true); 
                if (!bookState)
                    console.error("Error state somehow did not get stored; maybe it expired before reading?");
                else {
                    let [state, stamp] = bookState;
                    if (stamp != lastTimestamp) {
                        window.close();
                        return;
                    }
                }
                // update booking state timestamp constantly to show the site did not timeout
                lastTimestamp = await setBookingState(courseID, "error", /*local=*/true);
            }, booking_expiry_msec * 0.4);
        }
    }
}


processDocument();
