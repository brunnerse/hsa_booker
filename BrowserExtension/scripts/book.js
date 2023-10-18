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
        while(submitElem.className != "sub")
            await sleep(100);
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
function removeClass(a, b) { 
    a.className = a.className.replace(new RegExp("\\b" + b + "\\b"), " ");
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
        // Insert user select elem
        document.getElementById("bs_form_head").innerHTML += '\
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

        download(USERS_FILE)
        .then((d) => {userdata = d ?? {};})
        .then(() => updateUserSelect(userSelectElem, userdata))
        // TODO way to check which user is supposed to be booked for
        // TODO or default user in options
        .then(async () => setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx")))
        .then(() => onSelectChange())
        .then(() => circumventCountdown())
        .then(async () => {
            if (await getOption("submitimmediately"))  {
                // find submit button and submit
                let submitButton = document.getElementById("bs_submit");
                console.assert(submitButton);
                document.forms[0].requestSubmit(submitButton);
            } else {
                // Do nothing
            }
        }); 

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
                inputElem.value = data["email"];  
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

        let bTags = document.getElementsByTagName("B");
        let nr;
        for (let bTag of bTags) {
            if (bTag.innerHTML.match(/^\d+$/)) {
                nr = bTag.innerHTML;
                break;
            }
        } 

        if (!nr) {
            console.error("Could not find number of booked course!");
            return;
        }
        // marked course as booked 
        download("bookedcourses")
        .then((d) => {
            d = d ?? [];
            d.push(nr);
            return upload("bookedcourses", d);
        })
        .then((bookedCourses) => {
            console.log("Successfully informed server about successful booking.");
            console.log("Booked courses: ");console.log(bookedCourses);
        }); 
    } else {
        // signalize error
        console.log("STATE IS ERROR");
    }
}


processDocument();