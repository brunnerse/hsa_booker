const FILE = "users.json";
let userdata;

const userSelectElem = document.getElementById("userselect");
const formElem = document.getElementById("bs_form_main");
const statusElem = document.getElementById("statustext");


function sleep(msec) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, msec);
    })
}


function getJSONFileString(obj) {
    const tab="    ";
    let jstr = JSON.stringify(obj);
    let str = "";
    let level = 0;
    for (let c of jstr) {
        switch (c) {
            case "{":
                level++;
                str += c + "\n" + tab.repeat(level);
                break;
            case "}":
                level--;
                str += "\n" + tab.repeat(level) + c + tab.repeat(level);
                break;
            case ",":
                str += c + "\n" + tab.repeat(level);
                break;
            case ":":
                str += " " + c + tab + tab;
                break;
            default:
                str += c;
        }
    }
    return str;
}

function downloadUserData() {
    setStatus("Fetching user data...");
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed loading user data");
            setStatus("Failed to load user data", "red");
            reject(err);
        };
        xhr.onloadend = async () => {
            if (xhr.status == "404")
                throw new Error("404: userdata.json not found on server");
            userdata = xhr.response;
            // TODO remove sleep
            await sleep(2000);
            setStatus("Fetched user data.")
            resolve(userdata);
        }
        xhr.open("GET", "userdata.json"); //TODO change to  FILE
        xhr.responseType = "json";
        xhr.send();
    });
}

function uploadUserData() {
    setStatus("Updating user data...");
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed writing to file!");
            setStatus("Failed to update user data", "red");
            reject(err);
        };
        xhr.onloadend = () => {
            if (xhr.status == "404")
                throw new Error("404: FILE " + FILE + " not found on server");
            userdata = xhr.response;
            updateUserSelect();
            setStatus("Successfully updated user data.");
            resolve();
        }
        xhr.open("POST", FILE + "?write");
        xhr.responseType = "json";
        xhr.send(getJSONFileString(userdata));
    });
}

async function updateUserSelect() {
    console.log("Updating user selection to:")
    console.log(userdata);


    let childrenToRemove = [];
    for (let child of userSelectElem) {
        if (!["", "NEW"].includes(child.value)) {
            childrenToRemove.push(child);
        }
    }
    childrenToRemove.forEach((child) => userSelectElem.removeChild(child));

    // TODO remove sleep
    await sleep(2000);

    for (let user of Object.keys(userdata)) {
        let elem = document.createElement("OPTION");
        elem.value = user;
        elem.innerHTML = user; 
        selectElem.appendChild(elem);
    }
}

function deleteUser(user) {
    delete userdata[user];
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed writing to file!");
            reject(err);
        };
        xhr.onloadend = () => {
            if (xhr.status == "404")
                throw new Error("404: FILE " + FILE + " not found on server");
            userdata = xhr.response;
            updateUserSelect();
            resolve();
        }
        xhr.open("POST", FILE + "?write");
        xhr.responseType = "json";
        xhr.send(getJSONFileString(userdata));
    });
}


// Updates form according to selected user
async function onSelectChange() {
    let selectedUser = getSelectedUser(); 
    if (selectedUser == "" || selectedUser == "NEW") {
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
            } 
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

async function clearForm() {
    let form = document.getElementById("bs_form_main");
    let inputElems = form.getElementsByTagName("INPUT");
    for (let inputElem of inputElems) {
        // uncheck sex radio buttons
        if (inputElem["name"] == "sex")
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

function setSelectedUser(user) {
    let idx = -1, i = 0;
    for (let i = 0; i < userSelectElem.options.length; i++) {
        if (userSelectElem.options[i].value == user) {
            idx = i;
            break;
        }
    }
    console.assert(idx != -1);
    userSelectElem.selectedIndex = idx;
    userSelectElem.dispatchEvent(new Event("change"));

}

function getSelectedUser() {
    const selectElem = document.getElementById("userselect");
    return selectElem.options[selectElem.selectedIndex].value; 
}

function setStatus(status, color="white") {
    let style = "text-align:center;height:20px;font-weight:bold;background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = status;
}

function toggleInert() {
    document.getElementById("btn_cancel").toggleAttribute("inert");
    document.getElementById("bs_submit").toggleAttribute("inert");
    document.getElementById("userselect").toggleAttribute("inert");
    //TODO inert input elems
}


document.getElementById("userselect").onchange = onSelectChange; 

document.getElementById("bs_submit").onclick = () => {
    toggleInert();
    let selectedUser = getSelectedUser();
    if (selectedUser == "" || selectedUser == "NEW")
        selectedUser = prompt("Enter the User ID", "");
    if (!selectedUser) {
        setStatus("User ID is invalid", "red");
    } else {
       addUser(selectedUser).then(() => setSelectedUser(selectedUser)).finally(toggleInert);
    }
};

document.getElementById("btn_cancel").onclick = () => {
    toggleInert();
    let selectedUser = getSelectedUser();
    if (selectedUser == "")
        clearForm().finally(toggleInert);
    else if (selectedUser == "NEW")
        clearForm().finally(toggleInert);
    else {
        if (confirm("Delete user " + selectedUser + "?")) {
            deleteUser(selectedUser).then(() => setSelectedUser("")).finally(toggleInert);
        };
    }
};




// TODO prevent refresh if user data are modified

// enable/disable certain input elements when statusorig changes
const statusorig = formElem.getElementsByTagName("SELECT")[0];
statusorig.addEventListener("change", () => {
    console.log("CHANGED");
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
    console.log(zsf);
    for (let e of inputElems) {
        let g = e.parentElement.parentElement;
        console.log("Checking element " + e.name + " class " + e.className);
        // if input element has classname bs_fval_status[xx], f = xx 
        if (f = e.className.match(regex)) {
            console.log(f);
            // set display style to block if zsf fits, otherwise set style to none and set attribute disabled
            g.style.display = zsf[f[1]] == f[2] ? "block" : "none"; 
            zsf[f[1]] == f[2] ? e.removeAttribute("disabled") : e.setAttribute("disabled", "disabled"); 
            try { e.focus() } catch (q) { } 
        }
    }
});


clearForm()
    .then(toggleInert)
    .then(downloadUserData)
    .then(updateUserSelect)
    .then(toggleInert);