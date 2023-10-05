const form = document.forms[0];

let userdata = {};

const STATES = ["fill", "check", "confirmed", "error"];

let STATE;


function circumventCountdown() {
    //TODO this doesnt work here as i cant access variable of another script, need to override onsubmit like this:
//    form.onsubmit = ownCheck();
    /*
    window.send = 1;
    let submitElem = document.getElementById("bs_submit");
    console.assert(submitElem);
    submitElem.className = "sub";
    console.log("Vals: " + window.send + " " + window.btime + " " + submitElem.className)
    // other way:
    //window.btime = -1; 
    //await sleep(1000);
    // Alternatively wait 7s until submitButton.className changed to sub to avoid attracting attention
    // while(submitElem.className != "sub")await sleep(100);
    */
}

function fillForm() {

}
async function onSelectChange() {
    let selectedUser = getSelectedUser(userSelectElem); 
    if (selectedUser == "") {
        clearForm(); 
    } else {
        let data = userdata[selectedUser];
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

if (STATE == "fill") {
    // Insert user select elem
    document.getElementById("bs_form_head").innerHTML += '\
                <div id="bs_ag">\
                    <div class="bs_form_row">\
                        <div class="bs_form_sp1">User-ID:<div class="bs_form_entext">Comment</div>\
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
    .then((d) => {userdata = d;})
    .then(() => updateUserSelect(userSelectElem, userdata))
    // TODO way to check which user is supposed to be booked for
    .then(() => setSelectedUser(userSelectElem, userSelectElem.options[userSelectElem.options.length-1].value))
    .then(() => onSelectChange())
    .then(() => circumventCountdown())
    ;

    // find submit button and submit
    let submitButton = document.getElementById("bs_submit");
    console.assert(submitButton);
    //sleep(5000)
    //.then(form.requestSubmit(submitButton));

} else if (STATE == "check") {
    // find submit button
    let inputElems = form.getElementsByTagName("INPUT");
    let submitButton; 
    for (let inputElem of inputElems) {
        if (inputElem.title == "fee-based order") {
            submitButton = inputElem;
            break;
        }
    }

    // submit
    console.assert(submitButton);
    form.requestSubmit(submitElem); 

} else if (STATE == "confirmed") {
    // signalize success
    console.log("STATE IS SUCCESS")

} else {
    // signalize error
    console.log("STATE IS ERROR")
}