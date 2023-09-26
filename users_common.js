const USER_FILE = "userdata.json"

function downloadUserData() {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed loading user data");
            reject(err);
        };
        xhr.onloadend = async () => {
            if (xhr.status == "404")
                throw new Error("404: userdata.json not found on server");
            // TODO remove sleep
            await sleep(1000);
            resolve(xhr.response);
        }
        xhr.open("GET", USER_FILE); 
        xhr.responseType = "json";
        xhr.send();
    });
}

function uploadUserData(userdata) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed writing to file!");
            reject(err);
        };
        xhr.onloadend = async () => {
            if (xhr.status == "404")
                throw new Error("404: FILE " + FILE + " not found on server");
            resolve(xhr.response);
        }
        xhr.open("POST", USER_FILE + "?write");
        xhr.responseType = "json";
        xhr.send(getJSONFileString(userdata));
    });
}

async function updateUserSelect(userSelectElem, userdata) {
    console.log("Updating user selection to:")
    console.log(userdata);

    let childrenToRemove = [];
    for (let child of userSelectElem) {
        if (child.value != "") {
            childrenToRemove.push(child);
        }
    }
    childrenToRemove.forEach((child) => userSelectElem.removeChild(child));

    for (let user of Object.keys(userdata)) {
        let elem = document.createElement("OPTION");
        elem.value = user;
        elem.innerHTML = user; 
        userSelectElem.appendChild(elem);
    }
}

function setSelectedUser(userSelectElem, user) {
    let idx = -1;
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

function getSelectedUser(userSelectElem) {
    return userSelectElem.options[userSelectElem.selectedIndex].value; 
}