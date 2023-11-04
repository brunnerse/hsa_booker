let userdata;

const userSelectElem = document.getElementById("userselect");
const formElem = document.getElementById("bs_form_main");
const statusElem = document.getElementById("statustext");

const formDataElem = document.getElementById("formdata");
const formdata = JSON.parse(formDataElem.textContent||formDataElem.innerText);


function removeWarnMarks() {
    let inputElems = formElem.getElementsByTagName("INPUT");
    for (let e of inputElems) {
        let g = e.parentElement;
        while (!g.className.match(/\bbs_form_row\b/))
            g = g.parentElement;
        removeClass(g, "warn");
    }

}
// returns name of element with wrong data
function checkForm() {
    let inputElems = formElem.getElementsByTagName("INPUT");

    for (let e of inputElems) {
        let g = e.parentElement;
        while (!g.className.match(/\bbs_form_row\b/))
            g = g.parentElement;
        removeClass(g, "warn");

        if (e.getAttribute("disabled") == "disabled" || g.className.split(" ").includes("hide"))
            continue;
        var f = e.className.match(/\bbs_fval_(.+?)\b/);
        if (!chk_input(e, f ? f[1] : "")) {
            // g is row
            g.className += " warn"; e.focus(); 
            console.log(g.children[0]);
            console.log(g.children[0].children[0].innerHTMl);
            return g.children[0].children[0].innerHTML.replace(/[:*]/g, "");
        }
    }
    return "";
}

// a is input elem, b is input elem class: bs_fval_[b]
function chk_input(a, b) {
    let F = formElem.parentElement; 
    if (a) {
        // C is value of input elem a; more concrete:
        // c is for select: the value of the selected elem
        // c is for radio buttons: 1 if (at least) one is checked, "" if none is checked
        // else:  a.value (trimmed)
        var c = "select-one" == a.type ? 
            a.options[a.selectedIndex].value 
            : "radio" == a.type ?
                 F.elements[a.name][0].checked || F.elements[a.name][1].checked || F.elements[a.name][2] && F.elements[a.name][2].checked || F.elements[a.name][3] && F.elements[a.name][3].checked ?
                     1 
                     : "" 
                : a.value.trim();
        
        // If bs_fval_name, then remove Dr|Prof
        // if bs_fval_iban or bs_fval_bic, transform to upper case and remove any characters not A-Z 0-9 
        // else if a.type is textarea, remove invalid characters ;: etc
       "name" == b ? 
            c = c.replace(/(Dr|Prof)\.\s?/g, "") 
            : "iban" == b || "bic" == b ?
                c = c.toUpperCase().replace(/[^A-Z0-9]/g, "") 
                : "textarea" == a.type && (c = c.replace(/[";:\-\(\)']/g, ""));
        
        // check which type f input it is according to b, then check if regex pattern matches
        // if any of the AND conditions (separated by ||) return true, the function returns false
        if ("" == b && "" != c && !EOK(c) 
            || "req" == b && !EOK(c) 
            || "name" == b && (
                    !EOK(c) || !grossklein(c) || -1 < c.indexOf(".") || c.match(/\d/)
                    ) 
            || !("ort" != b || c.match(/^[A-Z\-]{0,3}\s?\d{4,7}[A-Z]{0,2}\s.{2,}$/) && EOK(c)) 
            || "date" == b && !c.match(/^[0-3]?\d\.[01]?\d\.(19|20)?\d{2}$/) 
            || "iban" == b && !c.match(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/) 
            || "bic" == b && !c.match(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/) 
            || "kih" == b && "" != c && (!grossklein(c) || -1 < c.indexOf(".") || c.match(/\d/)) 
            || "num" == b && !c.match(/^\d+$/) 
            || "num2" == b && !c.match(/^\d\d?$/) 
                // false email only triggers return false if email is not empty, formdata.ep = 2 or (formdata.ep = 1 and endpreis and lastschrift)
            || "email" == b && !isEmail(c) && ("" != c 
                                || 2 == formdata.ep 
                                || document.getElementById("bs_lastschrift") && 1 == formdata.ep && endpreis)
            || "tel" == b && "" != c && !c.match(/^[0-9 -\\/()]+$/)
        )
           return !1
    } 
    return !0
}

// checks if string is valid, i.e. contains only characters is valid range, and is not empty or whitespace only 
function EOK(a) { 
    // replace ; with , replace newline \n and carriage return \r with space " "
    a = String(a).replace(/;/g, ",").replace(/\r|\n/g, " ");
    // return false if a is empty or only contains whitespace characters 
    return !a || a.match(/^\s*$/) ?
         !1 
    // return false if any character is not in the range 0x20-0xff 
    // or if any character is in the list, i.e. *%$ etc. 
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
    
    const isUpdate = userdata[user] ? true : false;
    if (!isFormModified()) {
        setStatus("User " + user + " already saved: No changes in data", "green");
        return;
    }

    setStatus("Fetching most recent user data...");
    return download(USERS_FILE)
    .then(async (d) => {
        // use empty user data if not stored yet or multipleusers is not enabled
        userdata = (d && await getOption("multipleusers")) ? d : {};
        userdata[user] = data;
        setStatus("Updating user data...");
    }).then(() => upload(USERS_FILE, userdata))
    .then((d) => userdata = d) 
    .then(() => updateUserSelect(userSelectElem, userdata))
    .then( () => {setStatus((isUpdate ? "Updated" : "Added") + " user " + user + ".", "green")})
    .catch( (err) => setStatus("Failed to " + (isUpdate ? "update" : "add") + " user " + user + ": Error " + err, "red"));
}

async function deleteUser(user) {
    setStatus("Fetching most recent user data...");
    return download(USERS_FILE)
    .then((d) => {
        userdata = d ?? {};
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
    if (!selectedUser) {
        clearForm(); 
    } else {
        let data = userdata[selectedUser];
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

        removeWarnMarks();
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
    let wrongInput = checkForm();
    if (wrongInput) {
        setStatus("Form invalid: " + wrongInput + " is wrong", "red");
        return;
    }
    let selectedUser = ""; 
    for (let inputElem of document.getElementsByTagName("INPUT")) {
        // uncheck sex radio buttons
        if (inputElem.name == "vorname") {
            selectedUser = inputElem.value; 
            break;
        }
    }
    
    if (!selectedUser.match(/[A-Za-z]+/)) {
        alert("The user name is invalid.");
        return;
    }

    toggleInert();
    addUser(selectedUser).then(() => setSelectedUser(userSelectElem, selectedUser)).finally(toggleInert);
};

document.getElementById("btn_cancel").onclick = () => {
    let selectedUser = getSelectedUser(userSelectElem);
    if (selectedUser == "")
        clearForm();
    else {
        if (confirm("Delete user " + selectedUser + "?")) {
            toggleInert(); 
            removeWarnMarks();
            deleteUser(selectedUser).then(() => setSelectedUser(userSelectElem, "")).finally(toggleInert);
        } 
    }
};



// enable/disable certain input elements when statusorig changes
const statusorig = formElem.getElementsByTagName("SELECT")[0];
statusorig.addEventListener("change", () => {
    let regex = /\bbs_fval_status(\d)(\d)\b/;
    let inputElems = formElem.getElementsByTagName("INPUT");
    const zsf = [0,0,0];
    for (var c = 1; 3 > c; c++) {
        // d: Indizes in stdata für Förderverein, Student etc
        var d = formdata.stdata.substr(2 * statusorig.selectedIndex, 2).split("");
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

// deactivate deleting users when multiple users are not allowed
getOption("multipleusers")
.then((multiusr) => {
    if (!multiusr) {
        document.getElementById("deletebutton").setAttribute("hidden", "");
        removeClass(document.getElementById("savebutton"), "bs_right");
        document.getElementById("savebutton").setAttribute("style", "margin: 0 auto");
        document.getElementById("savebutton").children[0].innerHTML = "Save changes";
        userSelectElem.parentElement.parentElement.setAttribute("hidden", "");
    }
});

clearForm()
    .then(toggleInert)
    .then(() => setStatus("Fetching userdata..."))
    .then(() => download(USERS_FILE))
    .then((d) => {userdata = d ?? {};})
    .then(() => updateUserSelect(userSelectElem, userdata))
    .then(() => setStatus("Fetched userdata."))
    .finally(toggleInert);

document.getElementById("backbutton").addEventListener("click", () => {
    if (window.history.length <= 1)
        window.close();
    else
        window.history.back();
}); 