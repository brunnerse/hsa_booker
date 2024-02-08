
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
let choiceIDs = [];
let armed = false; 
let bookingState = {};

let refreshTriggered = false;

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
    let style = "font-weight:bold;background-color:" + color + ";"
    if (!status)
        style += `color:${color};` // if no state is given, print text in same color as background
    statusElem.setAttribute("style", style);
    statusElem.replaceChildren();
    // split status into lines or use placeholder if no status
    let lines = status ? status.split("\n") : ["&nbsp;"];
    for (let i = 0; i < lines.length; i++) {
        let span = document.createElement("SPAN");
        span.innerText = lines[i];
        statusElem.appendChild(span);
        if (i < lines.length-1) 
            statusElem.appendChild(document.createElement("BR"));
    }
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
        // set status to empty if it was not changed in between
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
            try {
                window.open(browser.runtime.getURL("Users.html"));
            } catch {
                try {
                    window.open(`chrome-extension://${chrome.runtime.id}/Users.html`);
                } catch {
                    alert("Create a user profile by clicking on the HSA Booker extension icon in the upper right corner of your browser and selecting \"Add User\".")
                }
            } 
            // reset selection to the first blank one
            setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx"));
            return;
        }
    }
    if (updateButtons)
        modifyBookButtons();
}

function getCurrentSport() {
    try {
        let headElem = document.getElementsByClassName("bs_head")[0];
        return headElem ? headElem.innerText : null; 
    } catch {
        return undefined;
    }
}

async function onAdd(button) {
    let user = getSelectedUser(userSelectElem);
    if (!user) {
        alert("Create a user profile first by clicking on the HSA Booker extension icon in the upper right corner of your browser and selecting \"Add User\".")
        return;
    }

    let trElem = button.parentElement.parentElement;
    let nr = getCourseNr(trElem);
    let date = getCourseDateStr(trElem); 
    let courseID = nr + "_" + date;
    let sport = currentSport;

    setStatusTemp("Updating course data...", "white", 1000);
    if(choice[sport] && choice[sport][user] && choice[sport][user].includes(courseID))
        removeCourse(user, courseID);
     else 
        addCourse(user, courseID);
}

async function addCourse(user, courseID) {
    let sport = currentSport;
    if (!choice[sport])
        choice[sport] = {};
   if (!choice[sport][user])
       choice[sport][user] = [];
    if (!choice[sport][user].includes(courseID)) {
        choice[sport][user].push(courseID);
        await upload(CHOICE_FILE, choice)
        .then(() => setStatusTemp("Marked course " + courseID.split("_")[0] + " for booking", "green"))
        .catch((err) => {
            setStatusTemp( err, "red");
            throw err;
        });
    } else {
        throw new Error("Cannot add: course " + nr + " is already marked for user " + user);
    }
} 

async function removeCourse(user, courseID) {
    // remove from choice
 	if (removeIdFromChoice(choice, currentSport, user, courseID)) {
        await upload(CHOICE_FILE, choice)
        .then(() => removeBookingState(courseID))
        .then(() => setStatusTemp("Unmarked course " + courseID.split("_")[0], "green"))
        .catch((err) => {
            setStatusTemp( err, "red");
            throw err;
        });
    } else {
        throw new Error("Cannot remove: course " + nr + " is not marked for user " + user);
    }
}

async function arm(storedAsArmed=false) {
    armed = true;
    armText.innerText = "UNARM";
    let style = armButton.getAttribute("style").replace("green", "blue");
    armButton.setAttribute("style", style); 

    setStatusTemp("Checking if booking is possible...", "yellow", timeMS=1500);

    // mark website as armed in storage
    if (!storedAsArmed)
        storeAsArmed(currentSport);
    let sport = currentSport;

    if (choiceIDs.length == 0) {
        setStatusTemp("Unarming: No courses were marked for booking.", "yellow", timeMS=1500, setInert=true)
        .then(unarm);
        return;
    }

    let numCoursesDone = 0;
    let numCoursesFull = 0;
    // get all course number elements in the document
    let nrElems = document.getElementsByClassName("bs_sknr");

    for (let id of choiceIDs) {
        let state = bookingState[id] ? bookingState[id][0] : "unavailable";
        switch (state) {
            case "full":
                numCoursesFull++;
            case "booking":
            case "booked":
            case "unavailable":
                numCoursesDone++;
                break;
            case "ready":
            case "error":
                // book course: get form and bookbutton, then submit
                let [nr, date] = id.split("_");
                let bookButton;
                for (let nElem of nrElems) {
                    if (nElem.tagName == "TD" && nElem.innerText == nr) {
                        bookButton = nElem.parentElement.getElementsByTagName("INPUT")[0];
                        break;
                    }
                } 
                if (!bookButton || !bookButton.className.includes("bs_btn_buchen"))
                    break;
                let formElem = bookButton.parentElement;
                while (formElem.tagName != "FORM")
                    formElem = formElem.parentElement;
                formElem.requestSubmit(bookButton);
                numCoursesDone++;
                break;
            default:
        }
    } 

    if (numCoursesDone < choiceIDs.length) {
        // get time until refresh and start counter
        let refreshInterval;
        let bookingTime;
        let bookTimeElems = document.getElementsByClassName("bs_btn_autostart");
        if (bookTimeElems.length > 0) {
            bookingTime = bookTimeElems[0].innerText;
            let remainingTime = getRemainingTimeMS(bookingTime);
            // find correct threshold for current remaining time
            refreshInterval = refreshIntervals[refreshIntervals.length-1];
            for (let i = 0; i < refreshIntervals.length-2; i++) {
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
        let refreshIntervalID;

        refreshIntervalFun = function () {
            // if course has been unarmed in the meantime, stop 
            if (!armed) {
                clearInterval(refreshIntervalID);
                return;
            }

            let remTime = refreshInterval - (Date.now() - lastRefreshTime); 
            let statusStr = bookingTime ? "Booking available in " + getRemainingTimeString(bookingTime) + "\n" : ""; 
            setStatusTemp(statusStr + "Refreshing in " + Math.ceil(remTime/1000) + "...", "yellow", 1000);
            if (armed && remTime <= 0) {
                refreshTriggered = true;
                // update arm timeout and then reload the window
                storeAsArmed(sport)
                .then(() => {
                    window.open(window.location.href, "_self");
                    location.reload(true);
                });
            }
        };
        // execute function once immediately, then set interval
        refreshIntervalFun();
        refreshIntervalID = setInterval(refreshIntervalFun, 1000); 
    } else {
        setStatusTemp("Unarming: " + 
            (numCoursesFull == numCoursesDone ? "All marked courses are full." : "All marked courses were processed."),
            "yellow", 1500, true)
        .then(unarm);
    }
}

function unarm() {
    armText.innerText = "ARM";
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

function modifyBookButtons() {
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
        aktionElem.replaceChildren();
        // create button and add to bookElem
        let button = document.createElement("BUTTON");
        button.innerText = choiceIDs.includes(id) ? "MARKED" : "MARK FOR BOOKING"; 
        button.style = "width:95%; border-radius:5px;text-align:center;" 
            + (choiceIDs.includes(id) ? "background-color: green;color:white" : "");
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button) 

       // set booking state if stored
       let bookState = bookingState[id] ? bookingState[id][0] : null;
       if (!bookState) {
            // set bookingState according to className of book button
            if ("bs_btn_buchen" == className)
                bookState = "ready";
            else if (["bs_btn_ausgebucht", "bs_btn_warteliste"].includes(className))
                bookState = "full";
            else 
                bookState = "none";
            bookingState[id] = [bookState, Date.now()];
       }

       // color line according to bookingState
        switch (bookState) {
            case "booked":
                colorRow(trElem, "lawngreen");
                button.innerText = "BOOKED";
                break;
            case "booking":
                colorRow(trElem, "lightblue");
                button.innerText = "BOOKING...";
                break;
            case "error":
                colorRow(trElem, "darkorange");
                button.innerText = "BOOKING ERROR";
                break;
            case "full":
                if (choiceIDs.includes(id)) {
                    colorRow(trElem, "salmon");
                    button.innerText = "MARKED BUT FULL";
                    break;
                }
            default:
                colorRow(trElem, "none");
        };
    }
}

async function updateChoice(c, checkAllCourses=false) {
    choice = c ?? {};
    let user = getSelectedUser(userSelectElem);
    let sport = currentSport;
    choiceIDs = (user && sport && choice[sport] && choice[sport][user]) ?
         choice[sport][user] : [];

    // check for each course if bookstate_file exists and add the state in case it does
    // either check only choiceIDs or all IDs
    let IDsToCheck = choiceIDs;
    if (checkAllCourses) {
        IDsToCheck = [];
        for (let bookElem of document.getElementsByClassName("bs_sbuch")) {
            if (bookElem.tagName != "TD")
                continue;
            let trElem = bookElem.parentElement;
            let id = getCourseNr(trElem)+"_"+getCourseDateStr(trElem);
            IDsToCheck.push(id);
        }
    }
    for (let id of IDsToCheck) {
        // Only get states from sync; local states (i.e. "booking") get updated every second anyway 
        let bookState = await getBookingState(id, true, false, /*syncOnly=*/true);
        //console.log("Got booking state " + bookState + " for course " + id);
        if (bookState)
            bookingState[id] = bookState;
    } 

    modifyBookButtons();
}

async function updateUserdata(d) {
	// if userdata did not change, do nothing
	if (userdata == d)
		return;
	userdata = d ?? {};
    await updateUserSelect(userSelectElem, userdata);
}

// check the current site if it is a course site
let isCourseSite = false;
// check if URL is a course and update visible elements accordingly
if (currentUrl.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\/_[A-Z]\w+/)) {
    let course = currentSport; 
    setStatus("Click ARM to book the marked courses ASAP", "white");
    armButton.parentElement.removeAttribute("hidden");
    hintElem.innerText = "Mark the " + course + " courses that you want to be booked automatically";
    isCourseSite = true;
} else if (currentUrl.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
    setStatus("Course overview");
    hintElem.innerText = "Go to a course website to add the course";
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

        await download(CHOICE_FILE).then((data) => updateChoice(data, true));    

        // check if website should be armed
        let armTimestamp = await download(ARMED_FILE+currentSport);
        if (!hasExpired(armTimestamp, armed_expiry_msec)) {
            await arm(true);
            if (Date.now() - armTimestamp > 10000)
                storeAsArmed(currentSport);
        }

        // add storage listener for all kinds of changes
        addStorageListener((changes) => {
            //console.log("Storage change:")
            //console.log(changes);
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } else if (item == ARMED_FILE+getCurrentSport()) {
                    // check if item was removed
                    let storedAsArmed = changes[item].newValue != undefined;  
                    // do not need to check the timestamp here; just was updated, so timestamp must be fine
                    if (!storedAsArmed && armed)
                        unarm();
                    else if (storedAsArmed && !armed)
                        arm(true);
                } else if (item == CHOICE_FILE) {
                    updateChoice(changes[item].newValue);
                } else if (item.startsWith(BOOKSTATE_FILE)) {
                    let id = item.split("-").pop();
                    let statestampArr = changes[item].newValue;
                    let prevStateArr = bookingState[id] ?? [undefined, 0];
                    if (!statestampArr) {
                        delete bookingState[id];
                    // Do not update if course state is "booked"; Should never happen anyway, just a safety check 
                    } else if (!(bookingState[id] && bookingState[id] == "booked")) {
                        // This currently also integrates states from other courses for simplicity
                        bookingState[id] = statestampArr;
                    }
                    // modify book buttons if state changed
                    if (prevStateArr[0] != (statestampArr ? statestampArr[0] : undefined))
                        modifyBookButtons();
                }
            }
        });

        // Create function that periodically checks whether a booking state has expired
        setInterval(() => {
            let changed = false;
            for (let id of Object.keys(bookingState)) {
                let [state, stamp] = bookingState[id];
                if (state == "booking" && hasExpired(stamp, booking_expiry_msec)) {
                    delete bookingState[id];
                    changed = true;
                }
            }
            if (changed)
                modifyBookButtons();
        }, 500);
    }
}

loadInitialData();


// unarm when closing the window
unloadEventListener = function (e) {
    if (armed && !refreshTriggered){
        // set arm timestamp so it times out in 5 seconds
        let timeStamp = Date.now() - armed_expiry_msec + 5000;
        let file = ARMED_FILE + currentSport;
        upload(file, timeStamp);  
        // dont prevent closing, just unarm silently
        //e.preventDefault();
        //e.returnValue = "Unarm first before leaving the page!";
        //setTimeout(() => arm(), 1000);
        //return e.returnValue;
    }
}
window.addEventListener("beforeunload", unloadEventListener); 