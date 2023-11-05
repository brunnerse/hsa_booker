let form = document.forms[0];

let userdata = {};

const STATES = ["fill", "check", "confirmed", "error"];

let STATE;


async function circumventCountdown() {
    if (!(await getOption("bypasscountdown"))) {
        // Simply wait until countdown passed 
        //   await sleep(7200);
        let submitElem = document.getElementById("bs_submit");
        console.assert(submitElem);
        let messageElem = document.createElement("DIV");
        messageElem.className = "bs_form_row";
        messageElem.setAttribute("style", "text-align:center;font-weight:bold;color:green;background-color:none;");
        messageElem.innerHTML = "Submitting once the countdown is done...";
        submitElem.parentElement.insertBefore(messageElem, submitElem);
        while(submitElem.className != "sub")
            await sleep(50);
        submitElem.parentElement.removeChild(messageElem);
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
        else if (inputElem["name"] == "tnbed")
            inputElem.checked = true;
        else {
            // fill form data
            if (data[inputElem["name"]])
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
    let inputElems = form.getElementsByTagName("INPUT");
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
    selectElem.selectedIndex = 0;
    selectElem.dispatchEvent(new Event("change"));
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

    if (STATE == "fill") {
        // download user data
        download(USERS_FILE)
        .then((d) => {userdata = d ?? {};})

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
        } else {
            // single user; use first (and only) user in userdata
            let data = userdata[Object.keys(userdata)[0]];
            fillForm(form, data);
        }

        getOption("submitimmediately")
        .then((submitimm) => {
            if (submitimm) {
                circumventCountdown()
                .then(() => {
                    // find submit button and submit
                    let submitButton = document.getElementById("bs_submit");
                    console.assert(submitButton);
                    document.forms[0].requestSubmit(submitButton);
                });
            }
        }); 

        // set bookingState of course to booking
        // first get nr and date
        let spElems = document.getElementsByClassName("bs_form_sp2");
        let nr, date;
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

        if (nr && date) {
            let courseID = nr + "_"+date;
            let user = Object.keys(userdata)[0];
            // get user from userdata; single user assumption, i.e. user is the first one
            // mark course as booked 
            download(BOOKSTATE_FILE)
            .then((d) => {
                d = d ?? {};
                if (!d[user]) {
                    d[user] = {};
                }
                if (d[user][courseID] == "booked") {
                    console.warn("COURSE IS ALREADY MARKED AS BOOKED")
                    clearForm();
                } else if (d[user][courseID] == "xbooking") {
                    console.warn("COURSE IS CURRENTLY BEING BOOKED")
                    window.close();
                } else {
                    d[user][courseID] = "booking";
                    upload(BOOKSTATE_FILE, d);
                }
            })
            
            // reset state if window is refreshed 
            window.addEventListener("beforeunload", function (e) {
                download(BOOKSTATE_FILE)
                .then((d) => {
                    if (d[user][courseID] != "booked") {
                        delete d[user][courseID];
                        return upload(BOOKSTATE_FILE, d);
                    }
                })
                e.preventDefault();
                e.returnValue = "The changes will be lost";
            });
        } else {
            console.error("Could not find number or date of course: " + nr + ", " + date);
            return;
        }
 
    } else if (STATE == "check") {
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
                break;
            } else if (inputElem.name.startsWith("email_check")) {
                inputElem.value = emailVal;  
            }
        }

        if (await getOption("submitimmediately"))  {
            // submit
            console.assert(submitButton);
            //TODO in final version: uncomment the following line
            //form.requestSubmit(submitElem); 
        } else {
            // Do nothing
        }

    } else if (STATE == "confirmed") {
        // signalize success
        console.log("STATE IS SUCCESS");

        let tdTags = document.getElementsByTagName("TD");
        let nr, date;
        for (let td of tdTags) {
            if (td.innerHTML.match(/^\d+-\d+$/)) {
                nr = bTag.innerHTML;
            } else  {
                let m = bTag.innerHTML.match(/^\d+\.\d+.-\d+\.\d+\./);
                if (m) 
                    date = getFullDateStr(m[0].split("-")[0]);
            }
        } 

        if (nr && date) {
            let courseID = nr + "_"+date;
            // get user from userdata; single user assumption, i.e. user is the first one
            let user = await download(USERS_FILE).then((d) => Object.keys(d)[0]);
            // mark course as booked 
            download(BOOKSTATE_FILE)
            .then((d) => {
                d = d ?? {};
                if (d[user])
                    d[user] = {};
                d[user][courseID] = "booked";
                return upload(BOOKSTATE_FILE, d);
            })
        } else {
            console.error("Could not find number or date of booked course: " + nr + ", " + date);
            return;
        }
    } else {
        // signalize error
        console.log("STATE IS ERROR");
    }
}


processDocument();
