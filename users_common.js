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