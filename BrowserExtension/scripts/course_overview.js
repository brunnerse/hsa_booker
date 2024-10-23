
let userdata = {};
let choice = {};


async function onSelectChange(updateVisuals=true) {
    let optionElem = getSelectedOption(userSelectElem);
    if (optionElem.value == "") {
        // open user edit page in new tab
        try {
            window.open(browser.runtime.getURL("Users.html"));
        } catch {
            // try different way if browser.runtime did not work
            try {
                window.open(`chrome-extension://${chrome.runtime.id}/Users.html`);
            } catch {
                // Just do an info alert instead
                alert("Create a user profile by clicking on the HSA Booker extension icon in the upper right corner of your browser and selecting \"Add User\".")
            }
        } 
        // reset selection to the first blank one
        setSelectedIdx(userSelectElem, 
            (userSelectElem.options.length > 1) ? await getOption("defaultuseridx") : 1);
        return;
    }
    if (updateVisuals)
        modifyTableRows();
}



async function updateChoice(c) {
    choice = c ?? {};
    modifyTableRows();
}

async function updateUserdata(d) {
	// if userdata did not change, do nothing
	if (userdata == d)
		return;
	userdata = d ?? {};
    await updateUserSelect(userSelectElem, userdata);
    if (choice && Object.keys(choice).length > 0)
        updateChoice(choice, false);
}

// Confirm that the current site is a course overview site
if (currentUrl.match(/^\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
    setStatus("Course overview");
    hintElem.innerText = "Go to a course website to add the course";
} else {
    setStatus("Not a course website", "white");
    hintElem.innerText = "HSA Booker alert: Not a course website";
    document.getElementById("topbar").setAttribute("hidden", "");
    throw new Error("HSA Booker called on a website that is not a course website");
}

function modifyTableRows() {
    for (let elem of document.querySelectorAll("dd a")) {
        let isElemMarked = elem.parentElement.classList.contains("trstate-marked");
        let chosen = choice[elem.innerText] ? true : false;
        if (chosen && !isElemMarked) {
            elem.parentElement.classList.add("trstate-marked");
            let spanElem = document.createElement("span");
            spanElem.setAttribute("style", "color:green; float:left");
            spanElem.innerText = "✔";
            elem.parentElement.insertBefore(spanElem, elem);
        } else if (!chosen && isElemMarked) {
            elem.parentElement.classList.remove("trstate-marked");
            let spanChildren = elem.parentElement.getElementsByTagName("span");
            spanChildren.length > 0 && elem.parentElement.removeChild(spanChildren[0]);
        }
    }
}

async function loadInitialData() {
    await download(USERS_FILE).then(updateUserdata);
    // add listeners
    userSelectElem.addEventListener("change", (event) => event.isTrusted && onSelectChange(false));

    // only simple storage listener listening for user data
    addStorageListener((changes) => {
        for (let item of Object.keys(changes)) {
            if (item == USERS_FILE) {
                updateUserdata(changes[item].newValue); 
            } else if (item == CHOICE_FILE) {
                updateChoice(changes[item].newValue); 
            } 
        }
    });
    download(CHOICE_FILE).then(updateChoice); 
}

loadInitialData();

