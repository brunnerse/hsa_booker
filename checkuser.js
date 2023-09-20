const FILE = "users.json";
let userdata;

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

function loadUserData() {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed loading user data");
            reject(err);
        };
        xhr.onloadend = () => {
            if (xhr.status == "404")
                throw new Error("404: userdata.json not found on server");
            userdata = xhr.response;
            resolve(userdata);
        }
        xhr.open("GET", "userdata.json"); //TODO change to  FILE
        xhr.responseType = "json";
        xhr.send();
    });

}

async function updateUserSelect() {
    console.log("Updating user selection to:")
    console.log(userdata);

    let selectElem = document.getElementById("userselect");

    let childrenToRemove = [];
    for (let child of selectElem) {
        if (!["", "NEW"].includes(child.value)) {
            childrenToRemove.push(child);
        }
    }
    childrenToRemove.forEach((child) => selectElem.removeChild(child));

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
}

function setSelectedUser(user) {
    let selectElem = document.getElementById("userselect");
    let idx = -1, i = 0;
    for (let i = 0; i < selectElem.options.length; i++) {
        if (selectElem.options[i].value == user) {
            idx = i;
            break;
        }
    }
    console.assert(idx != -1);
    selectElem.selectedIndex = idx;
    selectElem.dispatchEvent(new Event("change"));

}

function getSelectedUser() {
    const selectElem = document.getElementById("userselect");
    return selectElem.options[selectElem.selectedIndex].value; 
}



document.getElementById("userselect").onchange = onSelectChange; 

document.getElementById("bs_submit").onclick = () => {

    loadUserData().then(updateUserSelect); 
};

document.getElementById("btn_cancel").onclick = () => {
    let selectedUser = getSelectedUser();
    if (selectedUser == "")
        clearForm();
    else if (selectedUser == "NEW")
        clearForm();
    else {
        if (confirm("Delete user " + selectedUser + "?")) {
            deleteUser(selectedUser).then(() => setSelectedUser(""));
        };
    }
};


clearForm();
loadUserData().then(updateUserSelect);


// TODO prevent refresh if user data are modified