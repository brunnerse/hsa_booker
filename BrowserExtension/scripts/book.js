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
    let selectedUser = getSelectedUser(userSelectElem); 
    if (selectedUser == "") {
        clearForm(); 
    } else {
        let data = userdata[selectedUser];
        fillForm(form, data);
    }
}

function fillForm(form, data) {
    // Set status select option
    let selectElems = form.getElementsByTagName("SELECT");
    let selectElem;
    for (let e of selectElems)
        if (e.name == "statusorig")
            selectElem = e;
    console.assert(selectElem);
    let ok = false;
    for (let i = 0; i < selectElem.options.length; i++) {
        if (selectElem.options[i].value == data.statusorig) {
            selectElem.selectedIndex = i;
            selectElem.dispatchEvent(new Event("change"));
            ok = true;
            break;
        }
    }
    if (!ok) {
        throw new Error("Did not find status element for " + data.statusorig);
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
        else if (data[inputElem.name]){
            inputElem.value = data[inputElem["name"]];
        } 
   }
}

function removeWarnMarks() {
    let inputElems = form.getElementsByTagName("INPUT");
    for (let e of inputElems) {
        let g = e.parentElement;
        while (g && !g.className.match(/\bbs_form_row\b/))
            g = g.parentElement;
        if (g)
            removeClass(g, "warn");
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
        let spElems = document.getElementsByClassName("bs_form_sp2");
        for (let sp of spElems) {
            for (let child of sp.children) {
                if (!nr && child.innerText.match(/^\d+$/))
                    nr = child.innerText;
                else if (!date && child.innerText.match(/^(\d+\.)+\d*-(\d+\.)+\d*$/))
                    date = getFullDateStr(child.innerText.split("-")[0]);
            }
        }
    } else if (docState == "confirmed") {
        let tdTags = document.getElementsByTagName("TD");
        for (let td of tdTags) {
            if (!nr && td.innerText.match(/^\d+-\d+$/))
                nr = td.innerText.split("-")[0];
            else if (!date && td.innerText.match(/^(\d+\.)+\d*-(\d+\.)+\d*$/))
                date = getFullDateStr(td.innerText.split("-")[0]);
        }
    }
    if (nr && date) 
        return nr + "_"+date;
    console.error("Could not find number or date of course: " + nr + ", " + date);
    return null;
}

// resets the booking state if window is refreshed/closed 
function removeBookingStateOnClose(courseID) {
    window.addEventListener("beforeunload", function (e) {
        removeBookingState(courseID, local=true);
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
    console.log("Booking site is in state \"" + STATE + "\"");

    userdata = await download(USERS_FILE) ?? {};
    const courseID = getCourseID(STATE);
    let user = Object.keys(userdata).length > 0 ? Object.keys(userdata)[0] : null;

    if (STATE == "fill") {
        console.assert(submitElem);

        /*
        if (await getOption("multipleusers")) {
            // Insert user select elem
            document.getElementById("body").children[0].outerHTML += '\
                        <div id="bs_ag">\
                            <div class="bs_form_row">\
                                <div class="bs_form_sp1">User-ID:<div class="bs_form_entext">HSA Booker</div>\
                                </div>\
                                <div class="bs_form_sp2">\
                                    <select class="bs_form_field bs_fval_req" name="users" size="1" id="userselect">\
                                        <option value="" selected="selected">Neuer User</option>\
                                    </select>\
                                </div>\
                            </div>\
                        </div>\
                        <div class="bs_space"></div>\
            ';

            userSelectElem = document.getElementById("userselect");
            userSelectElem.addEventListener("change", onSelectChange); 
            updateUserSelect(userSelectElem, userdata)
            setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx"));
            onSelectChange();
        } 
        */
    
        if (user && courseID) {
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
                await sleep(1000);
                window.close();
                return;
            } else if (prevBookingState) {
                // if state was e.g. error, remove the state
                await removeBookingState(courseID, local=false);
            }
            
            lastTimestamp = await setBookingState(courseID, "booking", local=true);

            removeBookingStateOnClose(courseID);
            setInterval(async () => {
                // check if the last timestamp is the own one;
                // if not, another tab is writing and we should abort booking
                let bookState = await getBookingState(courseID, includeTimestamp=true, localOnly=true); 
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
                lastTimestamp = await setBookingState(courseID, "booking", local=true);
            }, booking_expiry_msec * 0.4);
        }

        if (await getOption("bypasscountdown")) {
                bypassCountdown();
        }

        if (userdata[user] && await getOption("fillform")) {
            fillForm(form, userdata[user]);
            // sometimes password fields are automatically set by browser autofill;
            // wait a few seconds for autofill, then reset their value
            sleep(4000).then(() => {
                for (let inputElem of form.getElementsByTagName("INPUT")) {
                        if (inputElem.name.startsWith("pw")) {
                        inputElem.value = "";
                    }
                }
            });

            if (await getOption("submitimmediately")) {
                // insert message that form will be submitted
                setBookingMessage("Submitting once the countdown is done...", "green");
                // wait until countdown passed
                while(submitElem.className != "sub") {
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
                if (await getOption("submitimmediately", allowCache=false))
                    form.requestSubmit(submitElem);
            }; 
        }
    } else if (STATE == "check") {
        if (user && courseID) {
            // Do not check if state is booked; if this page (check) is reached, user already decided to ignore it
            setBookingState(courseID, "booking", local=true);
            removeBookingStateOnClose(courseID);
            // update booking state timestamp constantly to show the site did not timeout
            setInterval(()=> {
                    setBookingState(courseID, "booking", local=true);
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
            }
        }

        if (await getOption("submitimmediately"))  {
            // submit
            console.assert(submitButton);
            //submitButton.setAttribute("inert", "");
            form.requestSubmit(submitButton); 
        } else {
            // Do nothing
        }
    } else if (STATE == "confirmed") {
        console.log(`Course Nr. ${courseID.split("_").join(" starting on ")} has been successfully booked.`);
        // signalize success by setting the global booking state
        if (user && courseID)
            await removeBookingState(courseID, local=true);
            await setBookingState(courseID, "booked", local=false);
    } else {
        // signalize error
        console.log("An error occured during booking.");
        if (user && courseID && (await getBookingState(courseID, false, false, syncOnly=true) != "booked")) {
            await removeBookingState(courseID, local=true);
            await setBookingState(courseID, "error", local=false);
        }
    }
}


processDocument();
