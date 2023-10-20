let userdata;
let choice;
const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const armButton = document.getElementById("armbutton"); 
const hintElem = document.getElementById("hint");

const refreshInterval_short = 2 * 1000;
const refreshInterval_mid = 5 * 1000;
const refreshInterval_long = 30 * 1000;
const timeThreshold_short = 15 * 1000; 
const timeThreshold_mid = 3 * 60 * 1000; 

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
            alert("To add users, click on the HSA Booker icon on the top right and click \"Edit User Data\".")
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
    let add = button.innerHTML.startsWith("MARK FOR BOOKING");
    let user = getSelectedUser(userSelectElem);
    if (!user) {
        alert("Select a user to add the course for in the top left corner first.")
        return;
    }

    let sport = getCurrentSport();

    // find nr
    let trElem = button.parentElement.parentElement;
    let nr = trElem.getElementsByClassName("bs_sknr")[0].innerHTML;

    // confirm if course is already full
    if (add && button.className == "bs_btn_ausgebucht")
        if (!confirm("Course is already full. Add nevertheless?"))
            return;

    setStatus("Fetching most recent choice data...");
    return download(CHOICE_FILE).then((d) => {
        choice = d ?? {};
        if (add) {
            if (!choice[sport])
                choice[sport] = {};
            if (!choice[sport][user])
                choice[sport][user] = [];
            console.log(choice);
            choice[sport][user].push(nr);
        } else {
            if (choice[sport] && choice[sport][user] && choice[sport][user].includes(nr)) {
                choice[sport][user].splice(choice[sport][user].indexOf(nr), 1);
                if (choice[sport][user].length == 0) {
                    delete choice[sport][user];
                    if (Object.keys(choice[sport]).length == 0)
                        delete choice[sport];
                }
            } else  {
                throw new Error("Course " + nr + "is not added for user");
            }
        }
        setStatus("Updating user data...");
    }).then(() => upload(CHOICE_FILE, choice))
    .then((d) => choice = d) 
    .then( () => {
        console.log("New choice data:");
        console.log(choice);
        modifyBookButtons();
        if (add && choice[sport] && choice[sport][user] && choice[sport][user].includes(nr))
//            setStatus("Added course " + nr + " for user " + user + ".", "green");
              setStatusTemp("Added course " + nr, "green");
        else if (!add && (!choice[sport] || !choice[sport][user] || !choice[sport][user].includes(nr)))
//          setStatus("Removed course " + nr + " from user " + user + ".", "green");
            setStatusTemp("Removed course " + nr, "green");
        else
            throw new Error("Choice is unchanged");
    })
    .catch( (err) => {
        if (add)
            setStatusTemp("Failed to add title: " + err.text, "red", 5000);
        else
            setStatusTemp("Failed to delete title: " + err.text, "red", 5000);
        console.log(err);
    });
}

var armed = false; 
var refreshIntervalID;

function onArm() {
    const armText =  document.getElementById("armbuttontext");
    const armButton =  document.getElementById("armbutton");
    armed = !armed;
    if (armed) {
        armText.innerHTML = "UNARM";
        let style = armButton.getAttribute("style").replace("green", "blue");
        armButton.setAttribute("style", style); 
        // mark website as armed in options
        download("armedcourses")
        .then((d) => {
            d = d ?? [];
            if (!d.includes(window.location.href))
                d.push(window.location.href);
            return upload("armedcourses", d);
        })
        .then(() => { 
            // TODO get all marked courses
            let sport = getCurrentSport();
            let user = getSelectedUser(userSelectElem);
            let nrlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user].slice(0) : [];
            console.log(choice);
            console.log("nrlist: " + nrlist);
            let finishedNrs = [];

            if (nrlist.length == 0) {
                setStatusTemp("Unarming: No courses were marked for booking.", "yellow", timeMS=1500, setInert=true)
                .then(onArm);
                return;
            }

            // get booking state
            let bookingState = {};

            for (let nr of nrlist) {
                let bookButton;
                let nrElems = document.getElementsByClassName("bs_sknr");
                for (let nElem of nrElems) {
                    if (nElem.tagName == "TD" && nElem.innerHTML == nr) {
                        bookButton = nElem.parentElement.getElementsByTagName("INPUT")[0];
                        break;
                    }
                }
                switch (bookButton ? bookButton.className : "") {
                    case "bs_btn_buchen":
                        bookingState[nr] = "ready";
                        finishedNrs.push(nr);
                        // TODO set status of course to booking
                        // book course
                        let formElem = bookButton.parentElement;
                        while (formElem.tagName != "FORM")
                            formElem = formElem.parentElement;
                        formElem.requestSubmit(bookButton);
                        break;
                    case "bs_btn_ausgebucht":
                    case "bs_btn_warteliste":
                        bookingState[nr] = "full";
                        finishedNrs.push(nr);
                        // TODO set status of course to failed
                        break;
                    default:
                        bookingState[nr] = "none";
                }
            }

            for (let fNr of finishedNrs) {
                nrlist.splice(nrlist.indexOf(fNr), 1);
            }

            if (nrlist.length > 0) {
                // get time until refresh and start counter; 
                // TODO if any titles not yet bookable
                let bookingTime;
                let bookTimeElems = document.getElementsByClassName("bs_btn_autostart");
                if (bookTimeElems.length > 0) 
                    bookingTime = bookTimeElems[0].innerHTML;
                let refreshInterval;
                let remainingTime = getRemainingTimeMS(bookingTime);
                if (remainingTime && remainingTime > timeThreshold_short) {
                    if (remainingTime > timeThreshold_mid) 
                        refreshInterval = Math.min(refreshInterval_long, remainingTime - timeThreshold_mid);
                    else
                        refreshInterval = Math.min(refreshInterval_mid, remainingTime - timeThreshold_short);
                } else {
                    refreshInterval = refreshInterval_short;
                }
                // refresh window in refreshInterval seconds
                let lastRefreshTime = Date.now();
                refreshIntervalID = setInterval(() => {
                    let remTime = refreshInterval - (Date.now() - lastRefreshTime); 

                    let statusStr = bookingTime ? "Booking available in " + getRemainingTimeString(bookingTime) + "<br>" : ""; 
                    setStatus(statusStr + "Refreshing in " + Math.ceil(remTime/1000) + "...", "yellow");
                    if (remTime <= 0)
                        window.location.reload();
                }, 333);
            } else {
                // call onArm again to unarm
                setStatusTemp("Unarming: All marked courses were processed.", "yellow", 1500, true)
                .then(onArm);
                return;
            }
        });
    } else {
        armText.innerHTML = "ARM";
        let style = armButton.getAttribute("style").replace("blue", "green");
        armButton.setAttribute("style", style); 
        // remove website from armed list in options
        download("armedcourses")
        .then((d) => {
            d = d ?? [];
            let idx = d.indexOf(window.location.href);
            if (idx >= 0) 
                d.splice(idx,1);
            return upload("armedcourses", d);
        })
        // clear refreshInterval
        if (refreshIntervalID)
            clearInterval(refreshIntervalID);
        setStatusTemp("Unarmed.");
    }
}


window.onload =  
() => {
    let url = window.location.href;
    // remove possible anchor from url
    url = url.split('#')[0];
    console.log("Loaded new frame:\n" + url);

    // check if URL is a course
    if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\/_[A-Z]\w+/)) {
        let course = getCurrentSport(); 
        setStatus("Click ARM to book the marked courses ASAP", "white");
        armButton.parentElement.removeAttribute("hidden");
        hintElem.innerHTML = "Mark the " + course + " courses that you want to be booked automatically";
        // modify page
        modifyBookButtons();
    } else if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
        setStatus("Course overview");
        hintElem.innerHTML = "Go to a course website to add the course";
    } else {
        setStatus("Not a course website", "white");
    }
};

function modifyBookButtons() {
    let sport = getCurrentSport();
    let user = getSelectedUser(userSelectElem);
    let nrlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user] : [];
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
        // get corresponding course nr
        let trElem = bookElem.parentElement;
        let nr = trElem.getElementsByClassName("bs_sknr")[0].innerHTML;
        let aktionElem = bookElem.parentElement.lastChild;
        // remove content of aktionElem
        while (aktionElem.lastChild)
            aktionElem.removeChild(aktionElem.lastChild);
        // create button and add to bookElem
        let button = document.createElement("BUTTON");
        button.innerHTML = nrlist.includes(nr) ? "MARKED" : "MARK FOR BOOKING"; 
        //button.className = className;
        button.style = "width:95%; border-radius:5px;text-align:center;" 
            + (nrlist.includes(nr) ? "background-color: green;" : "");
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button);
    }
}

userSelectElem.addEventListener("change", onSelectChange);
armButton.addEventListener("click", onArm);

// fetch userdata and initialize user bar
download(CHOICE_FILE)
.then((d) => {
    if (d && Object.keys(d).length > 0) {
        console.log("Choice is: ")
        choice = d; console.log(choice);
    } else {
        choice = {};
        console.log("Choice not stored");
    }
})    
.catch((err) => {
    choice = {};
    console.error("Error during reading storage:");
    console.error(err);
})
.then(() => download(USERS_FILE))
.then((d) => {userdata = d ?? {};})
.then(() => updateUserSelect(userSelectElem, userdata));

// check if website should be armed
download("armedcourses")
.then((d) => {
    if (d && d.includes(window.location.href))
        onArm();
});