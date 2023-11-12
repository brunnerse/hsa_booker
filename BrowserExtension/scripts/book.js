let form = document.forms[0];
let submitElem = document.getElementById("bs_submit");

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
    messageElem.innerHTML =  message;
}

async function circumventCountdown() {
    if (!(await getOption("bypasscountdown"))) {
        // insert message that form will be submitted
        setBookingMessage("Submitting once the countdown is done...", "green");
        // wait until countdown passed
        while(submitElem.className != "sub")
            await sleep(50);
    } else {
        // another try: injecting javascript code to set send=1
        // also not working due to content policy
        /*
        var s = document.createElement('script');
        s.setAttribute('type', 'text/javascript');
        s.setAttribute('src', 'scripts/bookinject.js');
        document.body.appendChild(s);
        console.log("injected javascript");
        */

        // Not pretty but working way:  Replace whole form with itself while removing the listener
        let newForm = form.cloneNode(true);
        newForm.removeAttribute("data-onsubmit");
        let data = userdata[getSelectedUser(userSelectElem)];
        // Replace whole form
        form.outerHTML = newForm.outerHTML;
        fillForm(document.forms[0], data);
        let submitElem = document.getElementById("bs_submit");
        console.assert(submitElem);
        submitElem.className = "sub";
    }
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
        throw new Error("Didn't find status element for " + data.statusorig);
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
                if (!nr && child.innerHTML.match(/^\d+$/)) {
                    nr = child.innerHTML;
                } else  {
                    let m = child.innerHTML.match(/^\d+\.\d+.-\d+\.\d+\./);
                    if (!date && m) 
                        date = getFullDateStr(m[0].split("-")[0]);
                }
            }
        } 
    } else if (docState == "confirmed") {
        let tdTags = document.getElementsByTagName("TD");
        for (let td of tdTags) {
            if (td.innerHTML.match(/^\d+-\d+$/)) {
                nr = bTag.innerHTML;
            } else {
                let m = bTag.innerHTML.match(/^\d+\.\d+.-\d+\.\d+\./);
                if (m)
                    date = getFullDateStr(m[0].split("-")[0]);
            }
        } 
    } 
    if (nr && date) 
        return nr + "_"+date;
    console.error("Could not find number or date of course: " + nr + ", " + date);
    return null;
}

function getBookingState(user, courseID) {
    return download(BOOKSTATE_FILE)
    .then((d) => getBookingStateFromData(d, user, courseID)); 
}

function setBookingState(user, courseID, bookingstate, avoidIfBooking=true) {
    return download(BOOKSTATE_FILE)
    .then((d) => {
        d = d ?? {};
        if (!d[user]) 
            d[user] = {};
        let prevBookingState = getBookingStateFromData(d, user, courseID); 
        if (!avoidIfBooking || !["booked", "booking"].includes(prevBookingState)){
            d[user][courseID] = bookingstate + "_" + Date.now();
            upload(BOOKSTATE_FILE, d);
        } else 
            console.warn("Not updating bookingstate: state is already set to " + prevBookingState);
        return prevBookingState;
    });
}

// resets the booking state if window is refreshed/closed 
function removeBookingStateOnClose(user, courseID) {
    window.addEventListener("beforeunload", function (e) {
        download(BOOKSTATE_FILE)
        .then((d) => {
            if (getBookingStateFromData(d, user, courseID) == "booking") {
                delete d[user][courseID];
                return upload(BOOKSTATE_FILE, d);
            }
        });
    }); 
}

async function processDocument() {
    // Check which state the site is in
    let nameInput;
    for (let input of form.getElementsByTagName("INPUT")) {
        if (input["name"] == "vorname") {
            nameInput = input;
            break;
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
    console.log("STATE IS " + STATE);

    const courseID = getCourseID(STATE);
    const userdata = await download(USERS_FILE) ?? {};
    let user = Object.keys(userdata).length > 0 ? Object.keys(userdata)[0] : null;

    if (STATE == "fill") {
        console.assert(submitElem);

        let alreadyBooked = false;
        // set booking state
        if (user && courseID) {
            let prevBookingState = await setBookingState(user, courseID, "booking");
            if (prevBookingState == "booked") {
                console.warn("COURSE IS ALREADY MARKED AS BOOKED")
                setBookingMessage("ALERT: COURSE HAS ALREADY BEEN BOOKED", "darkorange");
                alreadyBooked = true;
            } else if (prevBookingState == "booking") {
                setBookingMessage("COURSE IS CURRENTLY BEING BOOKED, CLOSING...", "red");
                await sleep(1000);
                window.close();
            }
        }
        removeBookingStateOnClose(user, courseID);

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
            // TODO way to check which user is supposed to be booked for; e.g. option?
            setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx"));
            onSelectChange();
        } 
        */
        if (userdata[user])
            fillForm(form, userdata[user]);

        // sometimes password fields are automatically set by browser autofill;
        // wait two seconds for autofill, then reset their value
        sleep(2000).then(() => {
            for (let inputElem of form.getElementsByTagName("INPUT")) {
                    if (inputElem.name.startsWith("pw")) {
                    inputElem.value = "";
                }
            }
        });

        if (!alreadyBooked) {
            getOption("submitimmediately")
            .then((submitimm) => {
                if (submitimm) {
                    circumventCountdown()
                    .then(() => {
                        // find submit button and submit
                        document.forms[0].requestSubmit(submitElem);
                    });
                }
            }); 
        }
    } else if (STATE == "check") {
        if (user && courseID) {
            // set booking state again
            await setBookingState(user, courseID, "booking");
            removeBookingStateOnClose(user, courseID);
        }

        let inputElems = form.getElementsByTagName("INPUT");
        let emailVal = "";
        for (let inputElem of inputElems) {
            if (inputElem.name == "email") {
                emailVal = inputElem.value;
                break;
            }
        }
        // find submit button and enter email check
        let submitButton; 
        for (let inputElem of inputElems) {
            if (inputElem.title == "fee-based order") {
                submitButton = inputElem;
            } else if (inputElem.name.startsWith("email_check")) {
                inputElem.value = emailVal;  
            }
        }

        if (await getOption("submitimmediately"))  {
            // submit
            console.assert(submitButton);
            submitButton.setAttribute("inert", "");
            //TODO in final version: uncomment the following line
            //form.requestSubmit(submitElem); 
        } else {
            // Do nothing
            submitButton.setAttribute("inert", "");
        }

    } else if (STATE == "confirmed") {
        // signalize success
        console.log("STATE IS SUCCESS");

        await setBookingState(user, courseID, "booked", false)

    } else {
        // signalize error
        console.log("STATE IS ERROR");
        if (user && courseID) {
            if (await getBookingState(user, courseID) != "booked")
                await setBookingState(user, courseID, "error", false);
        }
    }
}


processDocument();
