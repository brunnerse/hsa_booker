let userdata;

const userSelectElem = document.getElementById("userselect");
const formElem = document.getElementById("bs_form_main");
const statusElem = document.getElementById("statustext");


function checkForm() {
    let inputElems = formElem.getElementsByTagName("INPUT");

    for (let e of inputElems) {
        let g = e.parentElement.parentElement;
        removeClass(g, "warn");

        if (e.getAttribute("disabled") == "disabled" || g.className.split(" ").includes("hide"))
            continue;
        var f = e.className.match(/\bbs_fval_(.+?)\b/);
        if (!chk_input(e, f ? f[1] : "")) {
            // g is row
            g.className += " warn"; e.focus(); 
            return false;
        }
    }
    return true;
}

// a is input elem, b is input elem class: bs_fval_[b]
function chk_input(a, b) {
    let F = formElem.parentElement; 
//    let F = {elements : formElem.getElementsByTagName("INPUT")};
    //TODO formdata var
    if (a) {
        // c is for select: the value of the selected elem
        // c is for radio buttons: 1 if (at least) one is checked, "" if none is checked
        // else:  value.trim() of a 
        var c = "select-one" == a.type ? 
            a.options[a.selectedIndex].value 
            : "radio" == a.type ?
                 F.elements[a.name][0].checked || F.elements[a.name][1].checked || F.elements[a.name][2] && F.elements[a.name][2].checked || F.elements[a.name][3] && F.elements[a.name][3].checked ?
                     1 
                     : "" 
                : a.value.trim();
        
        // If bs_fval_name, then remove Dr|Prof
        // if bs_fval_iban or bs_fval_bic, transform to upper case and remove A-Z 0-9 
        // else if a.type is textarea, remove invalid characters ;: etc
       "name" == b ? 
            c = c.replace(/(Dr|Prof)\.\s?/g, "") 
            : "iban" == b || "bic" == b ?
                c = c.toUpperCase().replace(/[^A-Z0-9]/g, "") 
                : "textarea" == a.type && (c = c.replace(/[";:\-\(\)']/g, ""));
        
        // check which type f input it is according to b, then check if regex pattern matchesjj
        if ("" == b && "" != c && !EOK(c) 
            || "req" == b && !EOK(c) 
            || "name" == b && (!EOK(c) 
            || !grossklein(c) 
            || -1 < c.indexOf(".") 
            || c.match(/\d/)) 
            || !("ort" != b 
            || c.match(/^[A-Z\-]{0,3}\s?\d{4,7}[A-Z]{0,2}\s.{2,}$/) && EOK(c)) 
            || "date" == b && !c.match(/^[0-3]?\d\.[01]?\d\.(19|20)?\d{2}$/) 
            || "iban" == b && !c.match(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/) 
            || "bic" == b && !c.match(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/) 
            || "kih" == b && "" != c && (!grossklein(c) || -1 < c.indexOf(".") 
            || c.match(/\d/)) || "num" == b && !c.match(/^\d+$/) 
            || "num2" == b && !c.match(/^\d\d?$/) 
            || "email" == b && ("" != c 
                                || 2 == formdata.ep 
                                || document.getElementById("bs_lastschrift") && 1 == formdata.ep && endpreis) && !isEmail(c) 
                                || "tel" == b && "" != c && !c.match(/^[0-9 -\\/()]+$/)
        )
           return !1
    } 
    return !0
}

// check input helper functions
function EOK(a) { 
    // check sth??
    a = String(a).replace(/;/g, ",").replace(/\r|\n/g, " ");
    return !a || a.match(/^\s*$/) ?
         !1 
         : !a.match(/[\^\*"<>\[\]%{}`'\$]|[^\u0020-\u00ff]/) 
} 
function isEmail(a) { 
    // check email regex pattern
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(a)
}
function grossklein(a) {
    // Zähle in b die Anzahl der Kleinbuchstaben und in c die Anzahl der Großbuchstaben
    for (var b = 0, c = 0, d = a.length, h = 0; h < d; h++) {
        var k = a.charAt(h);
        k == k.toLowerCase() ? b++ : c++ 
    } 
    // Gibt true zurück, wenn sowohl Klein- als auch Großbuchstaben sowie mehr Klein- als Großbuchstaben in a vorkommen
    return 1 > c || 1 > b || c > b ? !1 : !0 
}

function removeClass(a, b) { 
    a.className = a.className.replace(new RegExp("\\b" + b + "\\b"), " ");
}

async function addUser(user) {
    // get data from form
    let data = {};

    // Get status select option
    let selectElem = formElem.getElementsByTagName("SELECT")[0];
    console.assert(formElem.getElementsByTagName("SELECT").length == 1);
    data.statusorig = selectElem.options[selectElem.selectedIndex].value;

    let inputElems = formElem.getElementsByTagName("INPUT");
    for (let inputElem of inputElems) {
        // Get sex radio button
        if (inputElem["name"] == "sex") {
            if (inputElem.checked)
                data.sex = inputElem.value; 
        } else {
            if (inputElem.getAttribute("disabled") != "disabled" && inputElem["name"] != "bic")
                // get form data
                data[inputElem["name"]] = inputElem.value;
        }
    }

    setStatus("Fetching most recent user data...");
    return download(USERS_FILE).then((d) => {
        userdata = d;
        userdata[user] = data;
        setStatus("Updating user data...");
    }).then(() => upload(USERS_FILE, userdata))
    .then((d) => userdata = d) 
    .then(() => updateUserSelect(userSelectElem, userdata))
    .then( () => {setStatus("Added user " + user + ".", "green")})
    .catch( (err) => setStatus("Failed to delete user " + user + ": Error " + err, "red"));
}

async function deleteUser(user) {
    setStatus("Fetching most recent user data...");
    return download(USERS_FILE).then((d) => {
        userdata = d;
        delete userdata[user];
        setStatus("Updating user data...");
    }).then(() => upload(USERS_FILE, userdata))
    .then((d) => userdata = d) 
    .then(() => updateUserSelect(userSelectElem, userdata))
    .then(() => setStatus("Deleted user " + user + ".", "green"))
    .catch( (err) => setStatus("Failed to delete user " + user + ": Error " + err, "red"));
}


// Updates form according to selected user
async function onSelectChange() {
    let selectedUser = getSelectedUser(userSelectElem); 
    if (selectedUser == "") {
        clearForm(); 
    } else {
        let data = userdata[selectedUser];
        let formElem = document.getElementById("bs_form_main");
        // Set status select option
        let selectElem = formElem.getElementsByTagName("SELECT")[0];
        console.assert(formElem.getElementsByTagName("SELECT").length == 1);
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

        let inputElems = formElem.getElementsByTagName("INPUT");
        for (let inputElem of inputElems) {
            // set sex radio button
            if (inputElem["name"] == "sex") {
                if (inputElem.value == data["sex"]) {
                    inputElem.checked = true; 
                } else {
                    inputElem.checked = false;
                } 
                inputElem.dispatchEvent(new Event("change"));
            } else {
                // fill form data
                if (data[inputElem["name"]] != undefined)
                    inputElem.value = data[inputElem["name"]];
            }
        }
    }
}

async function clearForm() {
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
    let selectElem = formElem.getElementsByTagName("SELECT")[0];
    selectElem.selectedIndex = 0;
    selectElem.dispatchEvent(new Event("change"));
}


function setStatus(status, color="white") {
    let style = "text-align:center;height:20px;font-weight:bold;background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = status;
}

function toggleInert() {
    console.log("toggling inert...");
    document.getElementById("btn_cancel").toggleAttribute("inert");
    document.getElementById("bs_submit").toggleAttribute("inert");
    document.getElementById("userselect").toggleAttribute("inert");

    for (let inputElem of formElem.getElementsByTagName("INPUT")) {
        inputElem.toggleAttribute("inert");
    }
}


document.getElementById("userselect").onchange = onSelectChange; 

document.getElementById("bs_submit").onclick = () => {
    if (!checkForm()) {
        setStatus("Form invalid", "red");
        return;
    }
    let selectedUser = getSelectedUser(userSelectElem);
    if (selectedUser == "")
        selectedUser = prompt("Enter the User ID for the new user", "");
    if (!selectedUser) {
        setStatus("Entered User ID is invalid", "red");
    } else {
       toggleInert();
       addUser(selectedUser).then(() => setSelectedUser(userSelectElem, selectedUser)).finally(toggleInert);
    }
};

document.getElementById("btn_cancel").onclick = () => {
    let selectedUser = getSelectedUser(userSelectElem);
    if (selectedUser == "")
        clearForm();
    else {
        if (confirm("Delete user " + selectedUser + "?")) {
            toggleInert(); 
            deleteUser(selectedUser).then(() => setSelectedUser(userSelectElem, "")).finally(toggleInert);
        } {

        }
    }
};



// enable/disable certain input elements when statusorig changes
const statusorig = formElem.getElementsByTagName("SELECT")[0];
statusorig.addEventListener("change", () => {
    let regex = /\bbs_fval_status(\d)(\d)\b/;
    let inputElems = formElem.getElementsByTagName("INPUT");
    const stdata = "0011112111323240";
    const zsf = [0,0,0];
    for (var c = 1; 3 > c; c++) {
        // d: Indizes in stdata für Förderverein, Student etc
        var d = stdata.substr(2 * statusorig.selectedIndex, 2).split("");
        // d[0] ist für Endpreis relevant, welcher hir nicht vorkommt
        d = [parseInt(d[0]), parseInt(d[1])];
        zsf[c] = d && d[1] ? d[1] : 0;
    }
    for (let e of inputElems) {
        let g = e.parentElement.parentElement;
        // if input element has classname bs_fval_status[xx], f = xx 
        if (f = e.className.match(regex)) {
            // set display style to block if zsf fits, otherwise set style to none and set attribute disabled
            g.style.display = zsf[f[1]] == f[2] ? "block" : "none"; 
            zsf[f[1]] == f[2] ? e.removeAttribute("disabled") : e.setAttribute("disabled", "disabled"); 
            try { e.focus() } catch (q) { } 
        }
    }
});



function isFormModified() {
    let inputElems = formElem.getElementsByTagName("INPUT");
    let selectedUser = getSelectedUser(userSelectElem);
    for (let inputElem of inputElems) {
        // check is text element has content and if that content differs from the saved user content
        if (inputElem["type"] == "text" && inputElem.getAttribute("disabled") != "disabled" && inputElem["value"]) {
            if (selectedUser == "" || inputElem.value != userdata[selectedUser][inputElem.name])
                return true;
        // check if user is saved and radio button is different
        } else if (inputElem["type"] == "radio" && selectedUser) {
            let isCheckedForUser = (userdata[selectedUser][inputElem.name] == inputElem.value); 
            if (isCheckedForUser != inputElem.checked) 
                return true;
        }
    }
    // check if user is saved and statusorig is different
    let selectElem = formElem.getElementsByTagName("SELECT")[0];
    console.assert(formElem.getElementsByTagName("SELECT").length == 1);
    let statusOrigVal = selectElem.options[selectElem.selectedIndex].value;
    if (selectedUser && statusOrigVal && statusOrigVal != userdata[selectedUser].statusorig)
        return true;

    return false;
}

// prevent refresh if user data are modified
window.onbeforeunload = function(e) {
    if (isFormModified()) {
        e.preventDefault();
        e.returnValue = "The changes to the user will be lost";
    }
}


clearForm()
    .then(toggleInert)
    .then(() => setStatus("Fetching userdata..."))
    .then(() => download(USERS_FILE))
    .then((d) => {userdata = d;})
    .then(() => updateUserSelect(userSelectElem, userdata))
    .then(() => setStatus("Fetched userdata."))
    .finally(toggleInert);