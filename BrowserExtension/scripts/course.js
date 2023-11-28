
const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const armButton = document.getElementById("armbutton"); 
const armText =  document.getElementById("armbuttontext");
const hintElem = document.getElementById("hint");

// store current url without anchor 
const currentUrl = window.location.href.split('#')[0];
const currentSport = getCurrentSport();

let userdata = {};
let choice = {};
let armed = false; 
let bookingState = {};
let booked = {};

const refreshIntervals = [1000, 2000, 5000, 30000];
const timeThresholds =   [0, 10000, 90000, Infinity]; 
const statusUpdateInterval = 500;


function getRemainingTimeMS(timeStr) {
    if (!timeStr || !timeStr.match(/\d+\.\d+[\.,\s]*\d+:\d+/))
        return null;
    let arr = timeStr.match(/\d+[:\.]\d+/g);
    let day = arr[0].split(".")[0];
    let month = arr[0].split(".")[1];
    let year = new Date(Date.now()).getUTCFullYear();
    let bookDate = new Date(`${year}-${month}-${day}T${arr[1]}`);
    return bookDate - new Date(Date.now());
}

function getRemainingTimeString(timeStr) {
    let remainMS = getRemainingTimeMS(timeStr);
    if (!remainMS)
        return null;
    let s = remainMS >= 0 ? "" : "- "; 
    remainMS = remainMS >= 0 ? remainMS : -remainMS; 

    let remDays = Math.floor(remainMS / (1000 * 60 * 60 * 24));
    remainMS -= remDays * (1000 * 60 * 60 * 24);
    let remHours = Math.floor(remainMS / (1000 * 60 * 60));
    remainMS -= remHours * (1000 * 60 * 60);
    let remMins = Math.floor(remainMS / (1000 * 60));
    remainMS -= remMins * (1000 * 60);
    let remSecs = Math.floor(remainMS / (1000));

    if (remDays > 0)
        s += remDays + "d ";
    if (remHours > 0)
        s += remHours + "h ";
    s += remMins + "m " + remSecs + "s";
    return s;
}

let statusId = 0;
function setStatus(status, color="white") {
    statusId += 1;
    let style = "font-weight:bold;background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = status ? status : `<div style="color:${color}">status</div>`;
}
function setStatusTemp(status, color, timeMS=1500, setInert=false) {
    setStatus(status, color);
    if (setInert) {
        armButton.setAttribute("inert", "");
    }
    const currentId = statusId;
    return new Promise((resolve) => setTimeout(() => {
        if (setInert) {
            armButton.removeAttribute("inert");
        }
        // set status to empty if it wasn't changed in between
        if (statusId == currentId) {
            setStatus("");
        }
        resolve();
    }, timeMS));

}


async function onSelectChange(updateButtons=true) {
    let selectedUser = getSelectedUser(userSelectElem);
    if (selectedUser == "") {
        if (userSelectElem.options[userSelectElem.selectedIndex].title == "adder") {
            // open user edit page in new tab
            // Opening extension directly doesnt work; make alert instead
            //window.open(chrome.runtime.getURL("Users.html"));
            alert("To add a user, click on the HSA Booker extension icon in the upper right corner of your browser and click \"Add User\".")
            // reset selection to the first blank one
            setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx"));
            return;
        }
    }
    if (updateButtons)
        modifyBookButtonsAndSetStates();
}

function getCurrentSport() {
    try {
        let headElem = document.getElementsByClassName("bs_head")[0];
        return headElem ? headElem.innerHTML : null; 
    } catch {
        return undefined;
    }
}

async function onAdd(button) {
    let user = getSelectedUser(userSelectElem);
    if (!user) {
        alert("Select a user to add the course for in the top left corner first.")
        return;
    }

    let trElem = button.parentElement.parentElement;
    let nr = getCourseNr(trElem);
    let date = getCourseDateStr(trElem); 

    setStatusTemp("Updating course data...", "white", 1000);
    if(button.innerHTML.match(/^MARK\s/))
        addCourse(user, nr, date);
     else 
        removeCourse(user, nr, date);
}

async function addCourse(user, nr, date) {
    let courseID = nr + "_" + date;
    let sport = currentSport;
    if (!choice[sport])
        choice[sport] = {};
   if (!choice[sport][user])
       choice[sport][user] = [];
    if (!choice[sport][user].includes(courseID)) {
        choice[sport][user].push(courseID);
        await upload(CHOICE_FILE, choice);
        setStatusTemp("Marked course " + nr + " for booking", "green");
    } else {
        throw new Error("Cannot add: course " + nr + " is already marked for user " + user);
    }
} 

async function removeCourse(user, nr, date) {
    // remove bookedState
    let id = nr+"_"+date;
    if (booked[user] && booked[user][id]) {
        delete booked[user][id];
        await upload(BOOKSTATE_FILE, booked);
    } 
    // remove from choice
 	if (removeNrFromChoice(choice, currentSport, user, nr)) {
        await upload(CHOICE_FILE, choice);	
        setStatusTemp("Unmarked course " + nr, "green");
    } else {
        throw new Error("Cannot remove: course " + nr + " is not marked for user " + user);
    }
}

async function arm(storedAsArmed=false) {
    armed = true;
    armText.innerHTML = "UNARM";
    let style = armButton.getAttribute("style").replace("green", "blue");
    armButton.setAttribute("style", style); 

    // mark website as armed in storage
    if (!storedAsArmed)
        storeAsArmed(currentSport);
    let sport = currentSport;
    let user = getSelectedUser(userSelectElem);
    let idlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user].slice(0) : [];

    if (idlist.length == 0) {
        setStatusTemp("Unarming: No courses were marked for booking.", "yellow", timeMS=1500, setInert=true)
        .then(unarm);
        return;
    }

    let numCoursesDone = 0;
    let numCoursesFull = 0;
    // get all course number elements in document
    let nrElems = document.getElementsByClassName("bs_sknr");

    for (let id of idlist) {
        let state = bookingState[id];
        switch (state) {
            case "full":
                numCoursesFull++;
            case "booking":
            case "booked":
                numCoursesDone++;
                break;
            case "ready":
            case "error":
                // book course: get form and bookbutton, then submit
                let [nr, date] = id.split("_");
                let bookButton;
                for (let nElem of nrElems) {
                    if (nElem.tagName == "TD" && nElem.innerHTML == nr) {
                        bookButton = nElem.parentElement.getElementsByTagName("INPUT")[0];
                        break;
                    }
                } 
                let formElem = bookButton.parentElement;
                while (formElem.tagName != "FORM")
                    formElem = formElem.parentElement;
                formElem.requestSubmit(bookButton);
                numCoursesDone++;
                break;
            default:
        }
    } 

    if (numCoursesDone < idlist.length) {
        // get time until refresh and start counter
        let refreshInterval;
        let bookingTime;
        let bookTimeElems = document.getElementsByClassName("bs_btn_autostart");
        if (bookTimeElems.length > 0) {
            bookingTime = bookTimeElems[0].innerHTML;
            let remainingTime = getRemainingTimeMS(bookingTime);
            // find correct threshold for current remaining time
            refreshInterval = refreshIntervals[refreshIntervals.length-1];
            for (let i = 0; i < refreshIntervals.length-1; i++) {
                if (remainingTime <= timeThresholds[i]) {
                    refreshInterval = refreshIntervals[i];
                    break;
                }
            }
        } else {
            // if no booking time is available, use a default refresh time
            refreshInterval = refreshIntervals[2];
        }

        // refresh window in refreshInterval seconds
        let lastRefreshTime = Date.now();
        let refreshIntervalID = setInterval(async () => {
            let remTime = refreshInterval - (Date.now() - lastRefreshTime); 

            let statusStr = bookingTime ? "Booking available in " + getRemainingTimeString(bookingTime) + "<br>" : ""; 
            setStatus(statusStr + "Refreshing in " + Math.ceil(remTime/1000) + "...", "yellow");
            if (armed && remTime <= 0) {
                // update arm timeout and then reload the window
                storeAsArmed(sport)
                .then(window.location.reload);
            } // if course has been unarmed in the meantime, clear this interval
            else if (!armed)
                clearInterval(refreshIntervalID);
        }, 333);
    } else {
        setStatusTemp("Unarming: " + 
            (numCoursesFull == numCoursesDone ? "All marked courses are full." : "All marked courses were processed."),
            "yellow", 1500, true)
        .then(unarm);
    }
}

function unarm() {
    armText.innerHTML = "ARM";
    let style = armButton.getAttribute("style").replace("blue", "green");
    armButton.setAttribute("style", style); 
    // remove website from armed list in options
    storeAsUnarmed(currentSport);
    setStatusTemp("Unarmed.");
    armed = false;
}

async function onArm() {
    if (!armed)
        return arm(); 
    else
        return unarm();
}

async function modifyBookButtonsAndSetStates() {
    let sport = currentSport;
    let user = getSelectedUser(userSelectElem);
    let idlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user] : [];
    
    // insert buttons into book table cell
    for (let bookElem of document.getElementsByClassName("bs_sbuch")) {
        if (bookElem.tagName != "TD")
            continue;
        // check book button and save its color (by classname)
        let className = "";
        let childElem = bookElem.lastChild;
        if (["BUTTON", "INPUT"].includes(childElem.tagName)) {
            className = childElem.className;
        }

        let trElem = bookElem.parentElement;
        let id = getCourseNr(trElem)+"_"+getCourseDateStr(trElem);

        let aktionElem = bookElem.parentElement.lastChild;
        // remove content of aktionElem
        while (aktionElem.lastChild)
            aktionElem.removeChild(aktionElem.lastChild);
        // create button and add to bookElem
        let button = document.createElement("BUTTON");
        button.innerHTML = idlist.includes(id) ? "MARKED" : "MARK FOR BOOKING"; 
        button.style = "width:95%; border-radius:5px;text-align:center;" 
            + (idlist.includes(id) ? "background-color: green;color:white" : "");
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button) 

       // set booking state if stored
       bookingState[id] = getBookingStateFromData(booked, user, id);
       if (!bookingState[id]) {
            // set bookingState according to className of book button
            if ("bs_btn_buchen" == className)
                bookingState[id] = "ready";
            else if (["bs_btn_ausgebucht", "bs_btn_warteliste"].includes(className))
                bookingState[id] = "full";
            else 
                bookingState[id] = "none";
       }
       // color line according to bookingState
        switch (bookingState[id]) {
            case "booked":
                colorRow(trElem, "lime");
                button.innerHTML = "BOOKED";
                break;
            case "booking":
                colorRow(trElem, "lightblue");
                button.innerHTML = "BOOKING...";
                break;
            case "error":
                colorRow(trElem, "darkorange");
                button.innerHTML = "BOOKING ERROR";
                break;
            case "full":
                if (idlist.includes(id)) {
                    colorRow(trElem, "salmon");
                    button.innerHTML = "MARKED BUT FULL";
                    break;
                }
            default:
                colorRow(trElem, "none");
        };
    }
}

function updateChoice(c) {
    choice = c ?? {};
    modifyBookButtonsAndSetStates();
}

function updateUserdata(d) {
	// if userdata didn't change, do nothing
	if (userdata == d)
		return;
	userdata = d ?? {};
    updateUserSelect(userSelectElem, userdata);
}



// check the current site if it is a course site
let isCourseSite = false;
// check if URL is a course and update visible elements accordingly
if (currentUrl.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\/_[A-Z]\w+/)) {
    let course = currentSport; 
    setStatus("Click ARM to book the marked courses ASAP", "white");
    armButton.parentElement.removeAttribute("hidden");
    hintElem.innerHTML = "Mark the " + course + " courses that you want to be booked automatically";
    isCourseSite = true;
} else if (currentUrl.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
    setStatus("Course overview");
    hintElem.innerHTML = "Go to a course website to add the course";
} else {
    setStatus("Not a course website", "white");
}


async function loadInitialData() {
    await download(USERS_FILE).then(updateUserdata);

    if (!isCourseSite) {
        // add listeners
        userSelectElem.addEventListener("change", () => onSelectChange(false));

        // only simple storage listener listening for user data
        addStorageListener((changes) => {
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } 
            }
        });
    } else {
        // add listeners
        userSelectElem.addEventListener("change", () => onSelectChange(true));
        armButton.addEventListener("click", onArm);

        // load booked data
        booked = await download(BOOKSTATE_FILE) ?? {};
        await download(CHOICE_FILE).then(updateChoice);    
        // check if website should be armed
        if (await isArmed(currentSport))
            arm(true);

        // add storage listener for all kinds of changes
        addStorageListener(async (changes) => {
            console.log("Storage change:")
            console.log(changes);
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } else if (item == ARMED_FILE) {
                    let storedAsArmed = await isArmed(currentSport, changes[item].newValue); 
                    if (!storedAsArmed && armed)
                        unarm();
                    else if (storedAsArmed && !armed)
                        arm(true);
                } else if (item == CHOICE_FILE) {
                    updateChoice(changes[item].newValue);
                } else if (item == BOOKSTATE_FILE) {
                    booked = changes[item].newValue ?? {};
                    // check if changes affect this sport 
                    if (bookingDataChanged(booked, changes[item].oldValue))
                        modifyBookButtonsAndSetStates();
                }
            }
        });

        // Create function that periodically checks whether a booking state has expired
        setInterval(() => {
            let user = getSelectedUser(userSelectElem);
            let changed = false;
            for (let id of Object.keys(bookingState)) {
                if (bookingState[id] == "booking") {
                    let storedState = getBookingStateFromData(booked, user, id); 
                    if (storedState != "booking") {
                        bookingState[id] = storedState; 
                        changed = true;
                    }
                }
            }
            if (changed)
                modifyBookButtonsAndSetStates();
        }, 1000);
    }
}


loadInitialData();

// unarm when closing the window
window.addEventListener("beforeunload", function (e) {
    if (armed){
        unarm(); 
        e.preventDefault();
        e.returnValue = "Unarm first before leaving the page!";
    }
}); 