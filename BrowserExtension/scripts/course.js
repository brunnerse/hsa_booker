
const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const armButton = document.getElementById("armbutton"); 
const armText =  document.getElementById("armbuttontext");
const hintElem = document.getElementById("hint");

let userdata = {};
let choice = {};
let armed = false; 
let bookingStates = {};

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

function setStatusTemp(status, color, timeMS=1500, setInert=false) {
    const statusText = status;
    setStatus(status, color);
    if (setInert) {
        armButton.setAttribute("inert", "");
    }
    return new Promise((resolve) => setTimeout(() => {
        if (setInert) {
            armButton.removeAttribute("inert");
        }
        // set status to empty if it wasn't changed in between
        if (statusElem.innerHTML == statusText) {
            setStatus("");
        }
        resolve();
    }, timeMS));

}

function setStatus(status, color="white") {
    let style = "font-weight:bold;background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = status ? status : `<div style="color:${color}">status</div>`;
}

async function onSelectChange() {
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
    modifyBookButtons();
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
    let remove = button.innerHTML.startsWith("MARKED");
    let user = getSelectedUser(userSelectElem);
    if (!user) {
        alert("Select a user to add the course for in the top left corner first.")
        return;
    }

    let trElem = button.parentElement.parentElement;
    let nr = getCourseNr(trElem);
    let date = getCourseDateStr(trElem); 

    console.log("Course " + nr + " start date is " + date);

    setStatus("Updating course data...");
    if (!remove) 
        addCourse(user, nr, date);
     else 
        removeCourse(user, nr, date);
}

async function addCourse(user, nr, date) {
    let courseID = nr + "_" + date;
    let sport = getCurrentSport();
    if (!choice[sport])
        choice[sport] = {};
   if (!choice[sport][user])
       choice[sport][user] = [];
    if (!choice[sport][user].includes(courseID)) {
        choice[sport][user].push(courseID);
        await upload(CHOICE_FILE, choice);
        setStatusTemp("Marked course " + nr + " for booking", "green");
    } else {
        throw new Error("Cannot add: course " + nr + "is already marked for user " + user);
    }
} 

async function removeCourse(user, nr, date) {
 	if (removeNrFromChoice(choice, getCurrentSport(), user, nr)) {
        await upload(CHOICE_FILE, choice);
        setStatusTemp("Unmarked course " + nr, "green");
    } else {
        throw new Error("Cannot remove: course " + nr + "is not marked for user " + user);
    }
}

function arm() {
    armed = true;
     //TODO check if another tab with the same site is open; if it is, only activate the one with the higher tab id and give a message for the other one 
    armText.innerHTML = "UNARM";
    let style = armButton.getAttribute("style").replace("green", "blue");
    armButton.setAttribute("style", style); 

    // mark website as armed in storage
    return storeAsArmed(getCurrentSport())
    .then(async () => { 
        // TODO get all marked courses
        let sport = getCurrentSport();
        let user = getSelectedUser(userSelectElem);
        let idlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user].slice(0) : [];
        console.log("idlist: " + idlist);
        let finishedIDs = await download(BOOKSTATE_FILE) ?? [];

        if (idlist.length == 0) {
            setStatusTemp("Unarming: No courses were marked for booking.", "yellow", timeMS=1500, setInert=true)
            .then(onArm);
            return;
        }

        // variable to check whether all marked courses are full TODO better way 
        let allCoursesFull = true;
        // get all course number elements in document
        let nrElems = document.getElementsByClassName("bs_sknr");

        for (let id of idlist) {
            let [nr, date] = id.split("_");
            let bookButton;
            for (let nElem of nrElems) {
                if (nElem.tagName == "TD" && nElem.innerHTML == nr) {
                    bookButton = nElem.parentElement.getElementsByTagName("INPUT")[0];
                    break;
                }
            }
            switch (bookButton ? bookButton.className : "") {
                case "bs_btn_buchen":
                    allCoursesFull = false;
                    finishedIDs.push(id);
                    // TODO set status of course to booking
                    //bookingState[nr] = "ready";
                    // book course
                    let formElem = bookButton.parentElement;
                    while (formElem.tagName != "FORM")
                        formElem = formElem.parentElement;
                    formElem.requestSubmit(bookButton);
                    break;
                case "bs_btn_ausgebucht":
                case "bs_btn_warteliste":
                    finishedIDs.push(id);
                    // Color the entire line light red
                    for (let c of bookButton.parentElement.parentElement.children) {
                        let style = c.getAttribute("style") ?? "";
                        c.setAttribute("style", "background-color:lightcoral;" + style);
                    }
                    // TODO set status of course to failed
                    //bookingState[nr] = "full";
                    break;
                default:
                    //bookingState[nr] = "none";
            }
            // TODO upload bookingState
        }

        for (let fId of finishedIDs) {
            idlist.splice(idlist.indexOf(fId), 1);
        }

        if (idlist.length > 0) {
            // get time until refresh and start counter; 
            // TODO if any titles not yet bookable
            let refreshInterval;
            let bookTimeElems = document.getElementsByClassName("bs_btn_autostart");
            if (bookTimeElems.length > 0) {
                let bookingTime = bookTimeElems[0].innerHTML;
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
            let refreshIntervalID = setInterval(() => {
                let remTime = refreshInterval - (Date.now() - lastRefreshTime); 

                let statusStr = bookingTime ? "Booking available in " + getRemainingTimeString(bookingTime) + "<br>" : ""; 
                setStatus(statusStr + "Refreshing in " + Math.ceil(remTime/1000) + "...", "yellow");
                if (armed && remTime <= 0)
                    window.location.reload();
                else if (!armed)
                    clearInterval(refreshIntervalID);
            }, 333);
        } else {
            // call onArm again to unarm
            setStatusTemp("Unarming: " + (allCoursesFull ? "All marked courses are full." : "All marked courses were processed."), "yellow", 1500, true)
            .then(onArm);
            return;
        }
    });
}

function unarm() {
    armed = false;
    armText.innerHTML = "ARM";
    let style = armButton.getAttribute("style").replace("blue", "green");
    armButton.setAttribute("style", style); 
    // remove website from armed list in options
    storeAsUnarmed(getCurrentSport());
    setStatusTemp("Unarmed.");
}

function onArm() {
    if (!armed)
      return arm(); 
    else
        return unarm();
}

async function modifyBookButtons() {
    let sport = getCurrentSport();
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
            + (idlist.includes(id) ? "background-color: green;color:white" : ""); // TODO also if booked 
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button);

        // TODO get bookedCourses 
        if (false && bookedCourses.includes(id)) {
            button.setAttribute("inert", ""); 
            button.innerHTML = "ALREADY BOOKED";
            // Color the entire line light green
            for (let c of bookElem.parentElement.children) {
                let style = c.getAttribute("style") ?? "";
                c.setAttribute("style", "background-color:lime;" + style);
            }
        }
    }
}

function updateChoice(c) {
    choice = c ?? {};
    modifyBookButtons();
}

function updateUserdata(d) {
	// if userdata didn't change, do nothing
	if (userdata == d)
		return;
	userdata = d ?? {};
    updateUserSelect(userSelectElem, userdata);
}



// add listeners
userSelectElem.addEventListener("change", onSelectChange);
armButton.addEventListener("click", onArm);

// check the current site if it is a course site
//get url and remove possible anchor from url
let url = window.location.href.split('#')[0];

let isCourseSite = false;
// check if URL is a course and update visible elements accordingly
if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\/_[A-Z]\w+/)) {
    let course = getCurrentSport(); 
    setStatus("Click ARM to book the marked courses ASAP", "white");
    armButton.parentElement.removeAttribute("hidden");
    hintElem.innerHTML = "Mark the " + course + " courses that you want to be booked automatically";
    isCourseSite = true;
} else if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
    setStatus("Course overview");
    hintElem.innerHTML = "Go to a course website to add the course";
} else {
    setStatus("Not a course website", "white");
}



async function loadInitialData() {
    await download(USERS_FILE).then(updateUserdata);

    if (!isCourseSite) {
        // only simple storage listener listening for user data
        addStorageListener((changes) => {
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } 
            }
        });
    } else {
        await download(CHOICE_FILE).then(updateChoice);    
        // check if website should be armed
        if (await isArmed(getCurrentSport))
            arm();

        // add storage listener for all kinds of changes
        addStorageListener(async (changes) => {
            console.log(changes);
            for (let item of Object.keys(changes)) {
                if (item == USERS_FILE) {
                    updateUserdata(changes[item].newValue); 
                } else if (item == ARMED_FILE) {
                    let storedAsArmed = await isArmed(getCurrentSport()); 
                    if (armed != storedAsArmed)
                        onArm();
                } else if (item == CHOICE_FILE) {
                    choice = changes[item].newValue ?? {};
                    modifyBookButtons();
                } else if (item == BOOKSTATE_FILE) {

                }
            }
        });
    }
}


loadInitialData();