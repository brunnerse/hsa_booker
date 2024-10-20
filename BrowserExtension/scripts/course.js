
const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const armButton = document.getElementById("armbutton"); 
const armText =  document.getElementById("armbuttontext");
let refreshSelectElem = document.getElementById("refreshselect");
const hintElem = document.getElementById("hint");

// store current url without anchor 
const currentUrl = window.location.href.split('#')[0];
const currentCourse = getCurrentCourse();

let userdata = {};
let choice = {};
let choiceIDs = [];
let armed = false; 
let bookingState = {};

let refreshTriggered = false;

const intervals_sec = {0: 1, 10: 2, 20: 5, 30: 10, 45: 15, 60: 20, Infinity: 30}
const statusUpdateInterval = 500;


function getBookDateFromTimeStr(timeStr) {
    if (!timeStr || !timeStr.match(/\d+\.\d+[\.,\s]*\d+:\d+/))
        return null;
    let arr = timeStr.match(/\d+[:\.]\d+/g);
    let day = arr[0].split(".")[0];
    let month = arr[0].split(".")[1];
    let year = new Date(Date.now()).getUTCFullYear();
    return new Date(`${year}-${month}-${day}T${arr[1]}`);
}

function getDurationAsString(durationMS) {
    if (!durationMS)
        return "";
    let s = (durationMS >= 0) ? "" : "- "; 
    durationMS = (durationMS >= 0) ? durationMS : -durationMS; 

    let days = Math.floor(durationMS / (1000 * 60 * 60 * 24));
    durationMS -= days * (1000 * 60 * 60 * 24);
    let hours = Math.floor(durationMS / (1000 * 60 * 60));
    durationMS -= hours * (1000 * 60 * 60);
    let mins = Math.floor(durationMS / (1000 * 60));
    durationMS -= mins * (1000 * 60);
    let secs = Math.floor(durationMS / (1000));

    if (days > 0)
        s += days + "d ";
    if (hours > 0)
        s += hours + "h ";
    s += mins + "m " + secs + "s";
    return s;
}

let statusId = 0;
function setStatus(status, color="white") {
    statusId += 1;
    statusElem.setAttribute("style", `font-weight:bold;background-color:${color};`);
    statusElem.replaceChildren();
    if (!status) { // If status is empty, use a space as placeholder
        statusElem.innerHTML = "&nbsp;";
    } else {
        // split status into lines or use placeholder if no status
        let lines = status.split("\n");
        for (let i = 0; i < lines.length; i++) {
            let span = document.createElement("SPAN");
            span.innerText = lines[i];
            statusElem.appendChild(span);
            if (i < lines.length-1) 
                statusElem.appendChild(document.createElement("BR"));
        }
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
    if (updateButtons)
        modifyBookButtons();
}

async function onRefreshChange(event) {
    if (event.isTrusted) {
        await upload(REFRESH_FILE, getSelected(refreshSelectElem));
    }
}

function getCurrentCourse() {
    try {
        let headElem = document.getElementsByClassName("bs_head")[0];
        return headElem ? headElem.innerText : null; 
    } catch {
        return undefined;
    }
}

async function onAdd(button) {
    let user = getSelected(userSelectElem);
    if (!user) {
        alert("Create a user profile first by clicking on the HSA Booker extension icon in the upper right corner of your browser and selecting \"Add User\".")
        return;
    }

    let trElem = button.closest("tr");
    let nr = getCourseNr(trElem);
    let date = getCourseDateStr(trElem); 
    let courseID = nr + "_" + date;
    let course = currentCourse;

    setStatusTemp("Updating course data...", "white", 1000);
    if(choice[course] && choice[course][user] && choice[course][user].includes(courseID))
        removeCourse(user, courseID);
     else 
        addCourse(user, courseID);
}

async function addCourse(user, courseID) {
    let course = currentCourse;
    if (!choice[course])
        choice[course] = {};
   if (!choice[course][user])
       choice[course][user] = [];
    if (!choice[course][user].includes(courseID)) {
        choice[course][user].push(courseID);
        await upload(CHOICE_FILE, choice)
        .then(() => setStatusTemp("Marked course " + courseID.split("_")[0] + " for booking", "green"))
        .catch((err) => {
            setStatusTemp( err.toString(), "red");
            throw err;
        });
    } else {
        throw new Error("Cannot add: course " + nr + " is already marked for user " + user);
    }
} 

async function removeCourse(user, courseID) {
    // remove from choice
 	if (removeIdFromChoice(choice, currentCourse, user, courseID)) {
        await upload(CHOICE_FILE, choice)
        .then(() => removeBookingState(courseID))
        .then(() => setStatusTemp("Unmarked course " + courseID.split("_")[0], "green"))
        .catch((err) => {
            setStatusTemp( err.toString(), "red");
            throw err;
        });
    } else {
        throw new Error("Cannot remove: course " + nr + " is not marked for user " + user);
    }
}

let armCounter = 0;

async function arm(storedAsArmed=false) {
    armed = true;
    armCounter += 1;
    armText.innerText = "UNARM";
    let style = armButton.getAttribute("style").replace("green", "blue");
    armButton.setAttribute("style", style); 
    refreshSelectElem.parentElement.removeAttribute("hidden");

    setStatusTemp("Checking if booking is possible...", "yellow", 1500);

    // Check if popups are allowed
    let popupsAllowedTimestamp = (await download(POPUP_FILE)) ?? 0; 

    // if timestamp is more than one hour old, test again if popups are possible 
    if (popupsAllowedTimestamp < Date.now() - 60*60*1000) {
        let popupTestUrl;
        try {
            popupTestUrl = browser.runtime.getURL("popupcheck.html");
        } catch {
            // use different url if browser.runtime did not work
            try {
                popupTestUrl = `chrome-extension://${chrome.runtime.id}/popupcheck.html`;
            } catch {
                popupTestUrl = "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/";
            }
        } 
        // Test opening popup with setTimeout
        let popup_window_t;
        let popup_t_test = new Promise(
            (resolve) => setTimeout(() => {
                popup_window_t = window.open(popupTestUrl, "_blank", "popup=1, width=200,height=200"); 
                if (popup_window_t)
                    try { popup_window_t.close(); } catch {}
                resolve();
            }, 0)
        );
        // Test opening popup directly
        let popup_window = window.open(popupTestUrl, "_blank", "popup=1, width=200,height=200"); 
        if (popup_window)
            try { popup_window.close(); } catch {}
        await popup_t_test;
        // If both tests were successful, store popup test as successful 
        if (popup_window && popup_window_t) {
            //await setStatusTemp("Popup check successful", "yellow", 500);
            upload(POPUP_FILE, Date.now()); 
        } else {
            alert("Pop-ups must be allowed for the automatic booking to work. "+
            "Change the pop-up settings for this website.");
            unarm();
            return;
        }
    }

    // mark website as armed in storage
    if (!storedAsArmed)
        storeAsArmed(currentCourse);
    let course = currentCourse;

    let numCoursesBooked = 0;
    let numCoursesFull = 0;
    let numCoursesBooking = 0;
    let unavailableCourses = [];

    for (let id of choiceIDs) {
        let state = bookingState[id] ? bookingState[id][0] : "unavailable";
        switch (state) {
            case "full":
                numCoursesFull++;
                break;
            case "booking":
                numCoursesBooking++;
                break;
            case "booked":
                numCoursesBooked++;
                break;
            case "unavailable":
                unavailableCourses.push(id); // Remove id from choiceIDs later 
                break;
            case "ready":
            case "error":
                // book course: get form and bookbutton, then submit
                let [nr, date] = id.split("_");
                // first find row element which has the wanted course number
                let rowElem;
                for (let nrElem of document.querySelectorAll("td.bs_sknr")) {
                    if (nrElem.innerText == nr) {
                        rowElem = nrElem.parentElement;
                        break;
                    }
                } 
                // if course has no nr or the date does not match, remove it
                if (!rowElem || (date != getCourseDateStr(rowElem))) { 
                    unavailableCourses.push(id); // Remove id from choiceIDs later
                    delete bookingState[id];
                    removeBookingState(id);
                } else {
                    // next find book button to check whether course is bookable
                    let bookButton = rowElem.getElementsByTagName("INPUT")[0];
                    if (bookButton && bookButton.classList.contains("bs_btn_buchen")) {
                        // book course and set as done
                        let formElem = bookButton.closest("form");
                        formElem.requestSubmit(bookButton);
                        numCoursesBooking++;
                    }
                }
                break;
            default:
        }
    } 

    unavailableCourses.forEach((id) => choiceIDs.splice(choiceIDs.indexOf(id), 1));


    if (numCoursesFull + numCoursesBooked + numCoursesBooking < choiceIDs.length) {
        // Try to get Date when booking is available
        let bookingDate = null;
        let bookTimeElems = document.getElementsByClassName("bs_btn_autostart");
        if (bookTimeElems.length > 0) 
            bookingDate = getBookDateFromTimeStr(bookTimeElems[0].innerText);

        // refresh window in refreshInterval seconds
        let refreshTime = Infinity;
        let prevRemainingTime = Infinity;
        let refreshIntervalID;
        let refreshChangeFun;
        let armCounterVal = armCounter;
        let refreshIntervalFun = function () {
            // if course has been unarmed (or re-armed) in the meantime, stop 
            if (!armed || armCounterVal != armCounter) {
                clearInterval(refreshIntervalID);
                refreshSelectElem.removeEventListener("change", refreshChangeFun);
                return;
            }
            // Update status if remaining time display changes
            let remainingTime = refreshTime - Date.now(); 
            if (Math.ceil(remainingTime/1000) != Math.ceil(prevRemainingTime/1000)) {
                prevRemainingTime = remainingTime;
                let statusStr = bookingDate ? "Booking available in " + getDurationAsString(bookingDate - Date.now()) + "\n" : ""; 
                setStatus(statusStr + "Refreshing in " + Math.ceil(remainingTime/1000) + "...", "yellow", 1000);
            }
            if (armed && remainingTime <= 0) {
                refreshTriggered = true;
                // update arm timeout and then reload the window
                storeAsArmed(course)
                .then(() => {
                    window.open(window.location.href, "_self");
                    location.reload(true);
                });
            }
        };

        // Add storage listener that updates refreshTime and calls refreshIntervalFun
        refreshChangeFun = function () {
            // Recalculate refreshTime
            let refreshInterval_sec = parseInt(getSelected(refreshSelectElem), 10); 
            if (isNaN(refreshInterval_sec)) {
                // calculate auto refresh
                refreshInterval_sec = 5;  //default value
                if (bookingDate) {
                    let remainingTime_sec = (bookingDate - Date.now()) / 1000.0;
                    // find correct threshold for current remaining time
                    let thresholds = Object.keys(intervals_sec).sort();
                    for (let thresh of thresholds) {
                        // Check if remainingTime falls into threshold + safety margin
                        if (remainingTime_sec - intervals_sec[thresh] <= thresh) {
                            refreshInterval_sec = intervals_sec[thresh];
                            break;
                        }
                    }
                }
            }
            refreshTime = Date.now() + refreshInterval_sec * 1000;
            // Call refreshIntervalFun() to update visuals and re-init the periodic call
            clearInterval(refreshIntervalID);
            refreshIntervalFun();
            refreshIntervalID = setInterval(refreshIntervalFun, 200);   
        }
        refreshSelectElem.addEventListener("change", refreshChangeFun);
        // Execute refreshListenerFun once to calculate refreshTime and set up the interval for refreshIntervalFun 
        refreshChangeFun(); 
    } else {
        if (numCoursesBooking > 0) {
            // TODO only unarm once there are no more courses in state "booking" 
            setStatus("Booking courses...", "lightblue");
            let checkUnarmIntervalID;
            let checkUnarmFun = async function () {
                let allProcessed = true;
                for (let courseID of choiceIDs) {
                    if (await getBookingState(courseID, /*includeTimestamp=*/false, /*localOnly=*/true)  == "booking") {
                        allProcessed = false;
                        break;
                    }
                }
                if (!armed) {
                    clearInterval(checkUnarmIntervalID);
                } else if (allProcessed) {
                    clearInterval(checkUnarmIntervalID);
                    setStatusTemp("Unarming: Finished booking.", "yellow", 1000, true)
                   .then(unarm);
                }
            }
            checkUnarmIntervalID = setInterval(checkUnarmFun, 500);

        } else {
            setStatusTemp("Unarming: " + (choiceIDs.length == 0 ? "No courses are marked." :  
                (numCoursesFull == choiceIDs.length ?       "All marked courses are full." : 
                (numCoursesFull > 0 ?                 "Remaining marked courses are full." :
                                                      "All marked courses were processed.")
                )),
                "yellow", 1000, true)
            .then(unarm);
        }
    }
}


async function unarm() {
    armText.innerText = "ARM";
    let style = armButton.getAttribute("style").replace("blue", "green");
    armButton.setAttribute("style", style); 
    refreshSelectElem.parentElement.setAttribute("hidden", "");
    // remove website from armed list in options
    await storeAsUnarmed(currentCourse);
    setStatusTemp("Unarmed.");
    armed = false;
}

function onArm() {
    if (!armed)
        return arm()
        .catch((err) => {
            setStatusTemp(err.toString(), "red");
            unarm();
            throw err;
        }); 
    else
        return unarm()
        .catch((err) => {
            setStatusTemp(err.toString(), "red");
            throw err;
        }); 
}

function modifyBookButtons() {
    // insert buttons into book table cell
    for (let bookElem of document.querySelectorAll("td.bs_sbuch")) {
        // check book button and save its color (by classname)
        let childElem = bookElem.querySelector("input,button");
        let className = childElem ? childElem.className : "";

        let trElem = bookElem.closest("tr");
        let id = getCourseNr(trElem)+"_"+getCourseDateStr(trElem);

        let aktionElem = bookElem.parentElement.lastChild;
        // remove content of aktionElem
        aktionElem.replaceChildren();
        // create button and add to bookElem
        let button = document.createElement("BUTTON");
        button.style = "width:95%; border-radius:5px; text-align:center;" 
            + (choiceIDs.includes(id) ? "background-color:green; color:white" : "");
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button) 

       // set booking state according to stored state and the booking button class
       let bookStateSite = "none" ;
        if (className.match(/\bbs_btn_buchen\b/))
           bookStateSite = "ready";
        else if (className.match(/\bbs_btn_(ausgebucht|warteliste)\b/))
           bookStateSite = "full";

       let bookState = bookingState[id] ? bookingState[id][0] : null;
       if (!bookState || (bookState == "error" && bookStateSite == "full")) {
            bookState = bookStateSite;
            bookingState[id] = [bookState, Date.now()];
       }

       // Color line and set button text according to bookingState
       const bookTexts = {
            "booked" : "BOOKED", "booking" : "BOOKING...",
            "error": "BOOKING ERROR", "full": "MARKED BUT FULL"};
       let isMarked = choiceIDs.includes(id);
       let text = bookTexts[bookState];

       // If in any booking state (except full when not marked), show that state
       if (text && !(bookState == "full" && !isMarked)) {
            button.innerText = text;
            colorRow(trElem, bookState);
       } else if (isMarked) { // Not in any booking state but marked
                button.innerText = "MARKED";
                colorRow(trElem, "marked");
       } else { // Not marked, not in any booking state (except maybe full)
            button.innerText = "MARK FOR BOOKING"; 
            colorRow(trElem, (bookState == "full") ? "fullunmarked" : "none");
       }
    }
}

async function updateChoice(c, checkAllCourses=false) {
    choice = c ?? {};
    let user = getSelected(userSelectElem);
    let course = currentCourse;
    choiceIDs = (user && course && choice[course] && choice[course][user]) ?
         choice[course][user] : [];

    // check for each course if bookstate_file exists and add the state in case it does
    // either check only choiceIDs or all IDs
    let IDsToCheck = choiceIDs;
    if (checkAllCourses) {
        IDsToCheck = [];
        for (let bookElem of document.querySelectorAll("td.bs_sbuch")) {
            let trElem = bookElem.closest("tr");
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

function updateRefresh(interval) {
    if (getSelected(refreshSelectElem) != interval) {
        setSelected(refreshSelectElem, interval);
    }
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

// check the current site if it is a course site
let isCourseSite = false;
// check if URL is a course and update visible elements accordingly
if (currentUrl.match(/^\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\/_[A-Z]\w+/)) {
    let course = currentCourse; 
    setStatus("Click ARM to book the marked courses", "white");
    armButton.parentElement.removeAttribute("hidden");
    hintElem.innerText = "Mark the " + course + " courses that you want to be booked automatically";
    isCourseSite = true;
} else if (currentUrl.match(/^\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
    setStatus("Course overview");
    hintElem.innerText = "Go to a course website to add the course";
} else {
    setStatus("Not a course website", "white");
}

function courseSiteOnChoice(choice) {
    choice = choice ?? {};
    for (let elem of document.querySelectorAll("dd a")) {
        let isElemMarked = elem.parentElement.classList.contains("trstate-marked");
        let chosen = choice[elem.innerText] ? true : false;
        if (chosen && !isElemMarked) {
            elem.parentElement.classList.add("trstate-marked");
            let spanElem = document.createElement("SPAN");
            spanElem.setAttribute("style", "color:green; float:left");
            spanElem.innerText = "✔";
            elem.parentElement.insertBefore(spanElem, elem);
        } else if (!chosen && isElemMarked) {
            elem.parentElement.classList.remove("trstate-marked");
            let spanChildren = elem.parentElement.getElementsByTagName("SPAN");
            spanChildren.length > 0 && elem.parentElement.removeChild(spanChildren[0]);
        }
    }
}

async function loadInitialData() {
    await download(USERS_FILE).then(updateUserdata);

    if (!isCourseSite) {
        // add listeners
        userSelectElem.addEventListener("change", (event) => event.isTrusted && onSelectChange(false));

        // only simple storage listener listening for user data
        addStorageListener((changes) => {
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } else if (item == CHOICE_FILE) {
                    courseSiteOnChoice(changes[item].newValue); 
                } 
            }
        });
        download(CHOICE_FILE).then(courseSiteOnChoice); 
    } else {
        // add listeners
        userSelectElem.addEventListener("change", (event) => event.isTrusted && onSelectChange(true));
        armButton.addEventListener("click", onArm);
        refreshSelectElem.addEventListener("change", onRefreshChange);

        download(REFRESH_FILE).then((data) => updateRefresh(data ?? refreshSelectElem.options[0].value))
        await download(CHOICE_FILE).then((data) => updateChoice(data, true));    

        // check if website should be armed
        let armTimestamp = await download(ARMED_FILE+currentCourse);
        if (!hasArmedExpired(armTimestamp)) {
            await arm(true);
            if (Date.now() - armTimestamp > 10000)
                storeAsArmed(currentCourse);
        }

        // add storage listener for all kinds of changes
        addStorageListener((changes) => {
            //console.log("Storage change:")
            //console.log(changes);
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } else if (item == REFRESH_FILE) {
                    updateRefresh(changes[item].newValue ?? refreshSelectElem.options[0].value);
                } else if (item == ARMED_FILE+getCurrentCourse()) {
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
                if (hasBookingStateExpired(state, stamp, true)) { 
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
        let file = ARMED_FILE + currentCourse;
        upload(file, timeStamp);  
        // dont prevent closing, just unarm silently
        //e.preventDefault();
        //e.returnValue = "Unarm first before leaving the page!";
        //setTimeout(() => arm(), 1000);
        //return e.returnValue;
    }
}
window.addEventListener("beforeunload", unloadEventListener); 