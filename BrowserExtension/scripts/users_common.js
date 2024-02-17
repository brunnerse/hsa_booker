async function updateUserSelect(userSelectElem, userdata) {
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
        elem.innerText = user; 
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
        setSelectedIdx(userSelectElem, await getOption("defaultuseridx"));
    }  
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