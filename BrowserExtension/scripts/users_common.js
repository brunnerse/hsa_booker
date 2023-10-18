async function updateUserSelect(userSelectElem, userdata) {
    console.log("Updating user selection to:")
    console.log(userdata);


    let childrenToRemove = [];
    for (let child of userSelectElem.children) {
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
    if (!(await getOption("multipleusers"))) {
        for (let idx = 0; idx < userSelectElem.children.length; idx++) {
            if (idx != await getOption("defaultuseridx")) {
                userSelectElem.children[idx].setAttribute("hidden", "");
            }
        }
        if (Object.keys(userdata).length == 0) 
            userSelectElem.children[0].removeAttribute("hidden");
        setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx"));
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
    setSelectedUserIdx(userSelectElem, idx);
}

function setSelectedUserIdx(userSelectElem, idx) {
    console.assert(idx != -1);
    userSelectElem.selectedIndex = idx;
    userSelectElem.dispatchEvent(new Event("change"));
}

function getSelectedUser(userSelectElem) {
    let userElem = userSelectElem.options[userSelectElem.selectedIndex]
    return userElem ? userElem.value : null; 
}