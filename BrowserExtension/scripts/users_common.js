async function updateUserSelect(userSelectElem, userdata) {
    let childrenToRemove = [];
    let emptyElem;
    // First remove all users...
    for (let child of userSelectElem.children) {
        if (child.value != "") 
            childrenToRemove.push(child);
        else 
            emptyElem = child;
    }
    childrenToRemove.forEach((child) => userSelectElem.removeChild(child));
    // Then add all current users again
    for (let user of Object.keys(userdata)) {
        let elem = document.createElement("OPTION");
        elem.value = user;
        elem.innerText = user; 
        userSelectElem.insertBefore(elem, emptyElem);
    }

    let numUsers = Object.keys(userdata).length;
    if (!(await getOption("multipleusers")) && numUsers > 1) {
        // Hide all child elements 
        for (let child of userSelectElem.children) {
            if (child.value != "")
                child.setAttribute("hidden", "");
        }
        userSelectElem.children[await getOption("defaultuseridx")].removeAttribute("hidden"); 
    } 
    if (numUsers == 0 || await getOption("multipleusers")) {
        emptyElem.innerText = "Add user";
    } else {
        emptyElem.innerText = "Edit user";
    }
    setSelectedIdx(userSelectElem, numUsers > 0 ? await getOption("defaultuseridx") : 0);

}

function setSelected(selectElem, value) {
    let idx = -1;
    for (let i = 0; i < selectElem.options.length; i++) {
        if (selectElem.options[i].value == value) {
            idx = i;
            break;
        }
    }
    console.assert(idx != -1);
    setSelectedIdx(selectElem, idx);
}

function setSelectedIdx(selectElem, idx) {
    console.assert(idx >= 0);
    selectElem.selectedIndex = idx;
    selectElem.dispatchEvent(new Event("change"));
}

function getSelected(selectElem) {
    let option = selectElem.options[selectElem.selectedIndex];
    return option ? option.value : null; 
}

function getSelectedOption(selectElem) {
    return selectElem.options[selectElem.selectedIndex];
}