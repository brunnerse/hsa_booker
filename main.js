const INACTIVE = false;
const HSA_LINK_new = "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/";
const HSA_LINK_old = "https://web.archive.org/web/20220120140607/https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"
var HSA_LINK = HSA_LINK_new;


const refreshInterval_short = 2 * 1000;
const refreshInterval_mid = 5 * 1000;
const refreshInterval_long = 30 * 1000;
const timeThreshold_short = 15 * 1000; 
const timeThreshold_mid = 3 * 60 * 1000; 

const statusUpdateInterval = 500;

const timeout_msec = 6000;

var allStatusInterval;

var choice = undefined;
var userdata = undefined;

// Dictionary from course name to link
var courses = {};
// Dictionary from title to state (ready, full, none, booked, booking, missing, wrongnumber, failed (to load site))
var bookingState = {};

// Dictionary from title to start time
var bookingTime = {};
// Dictionary from title to HTML element containing the status of the title
var statusElements = {};

var ongoingXMLRequests = {};
var armID = 0;


function getColorForBookingState(bookingState) {
    let colors = {"booked" : "#00ff00", "booking" : "blue", "ready" : "aqua", 
        "full": "#ff0000", "missing": "maroon",
        "failed": "gray", "wrongnumber": "orange", "wronguserid" : "darkorange", "none": "white"};
    if (colors[bookingState])
        return colors[bookingState];
    return "white";
}

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

function requestHTML(method, url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        // abort any ongoing request to the same url
        if (ongoingXMLRequests[url]) {
            console.log("Abort ongoing HTML request to " + url);
            ongoingXMLRequests[url].abort();
        }
        ongoingXMLRequests[url] = xhr;

        xhr.open(method, url);
        xhr.responseType = "document";
        xhr.timeout = timeout_msec;
        xhr.onloadend = function () {
            delete ongoingXMLRequests[url];
            if (this.status >= 200 && this.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            delete ongoingXMLRequests[url];
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.ontimeout = function () {
            delete ongoingXMLRequests[url];
            reject({
                status: this.status,
                statusText: "timeout " + xhr.statusText
            });
        };
        xhr.send();
    });
}


function updateStatus(str, style="append") {
    const elem = document.getElementById("statustext");
    const newHTML = "<strong>" + new Date().toLocaleTimeString() + "</strong>:&emsp;&emsp;" + str;
    switch (style) {
        case "replace":
            let text = elem.innerHTML;
            const tag = "<br>";
            const idx = text.lastIndexOf(tag);
            if (idx >= 0) {
                elem.innerHTML = text.substring(0, idx + tag.length) + newHTML;
                break;
            }
            // else do clear
        case "clear":
            if (str.length == 0)
                elem.innerHTML = "";
            else
                elem.innerHTML = newHTML;
            break;
        case "append":
        default:
            if (elem.innerHTML.length == 0) {
                elem.innerHTML += newHTML;
            } else {
                elem.innerHTML += "<br>" + newHTML;
            }
    }
}


function getErrorTable(nr, details, error) {
    const notAvailElem = document.getElementById("notavail").cloneNode(true);
    const notAvailNr = notAvailElem.getElementsByClassName("bs_sknr")[1];
    const notAvailName = notAvailElem.getElementsByClassName("bs_sdet")[1];
    const notAvailMsg = notAvailElem.getElementsByClassName("bs_sbuch")[1];
    notAvailNr.innerHTML = nr;
    notAvailName.innerHTML = details;
    notAvailMsg.innerHTML = error;
    return notAvailElem.getElementsByTagName("TR")[1].innerHTML;
}


function updateTitleWithTime(title, time_msec, preMsg="", postMsg="") {
    updateEntryStateTitle(title, preMsg + 
        Math.ceil(time_msec / 1000) + postMsg,
        "#ffff00");
}

async function bookCourse(title) {
    console.log("Called bookCourse(" + title + "); Course has state " + bookingState[title]);
    
    if (bookingState[title] == "booked") {
        updateEntryStateTitle(title, "Already booked", getColorForBookingState(bookingState[title]));
        return;
    } else if (bookingState[title] != "ready") {
        console.warn("Booking failed: " + bookingState[title]);
        updateEntryStateTitle(title, "Booking failed: " + bookingState[title], "red");
        return;
    }

    bookingState[title] = "booking";
    updateStatus("Booking course " + title);
    updateEntryStateTitle(title, "Started booking...", "blue");

    // get userdata
    const user = title.split("_")[2];
    const data = userdata[user];
    if (!data){
        updateEntryStateTitleErr(title, "userdata for " + user + " not found");
        bookingState[title] = "error";
        console.warn("Error during booking of " + title + ": " + 
            "ERROR: userdata for " + user + " not found!");
        return;
    }
    
    // find iframe for course
    let frameRootElem  = document.getElementById("formframes");
    let iFrameElem;
    for (let child of frameRootElem.children) { 
        let iFrameChild = child.getElementsByTagName("IFRAME")[0];
        if (iFrameChild.name == "frame_" + title) { 
            iFrameElem = iFrameChild;
            break;
        }
    }
    console.assert(iFrameElem);
    // find form element for course
    let form;
    for (let bsContent of document.getElementById("choice").children) {
        if (bsContent.getAttribute("title") == title) {
            form = bsContent.children[0];
            break;
        }
    }
    console.assert(form.tagName == "FORM");
    // find submit element for button
    let submitElem;
    for (let inputElem of form.getElementsByTagName("INPUT"))
        if (inputElem.type == "submit")
            submitElem = inputElem;
    console.assert(submitElem);

    // function called on the first submit form (the Enter User Data form)
    iFrameElem.onload = 
        async function (event) { 
            let frameDoc = iFrameElem.contentDocument;

            // Fill form and submit
            let form = frameDoc.getElementsByTagName("FORM")[0];
            if (!form) {
                updateEntryStateTitleErr(title, "Form not found");
                bookingState[title] = "error";
                console.warn("Error during booking of " + title + ": " + 
                    "Form on first screen not found!");
                return;
            }
            // make form target external
            form.action = "/extern/" + form.action + "?referer=https://anmeldung.sport.uni-augsburg.de/cgi/anmeldung.fcgi";
            // Set status select option
            let selectElem = form.getElementsByTagName("SELECT")[0];
            console.assert(form.getElementsByTagName("SELECT").length == 1);
            let ok = false;
            for (let i = 0; i < selectElem.options.length; i++) {
                if (selectElem.options[i].value == data.statusorig) {
                    selectElem.selectedIndex = i;
                    selectElem.dispatchEvent(new Event("change"));
                    ok = true;
                    break;
                }
            }
            if (!ok) {
                updateEntryStateTitleErr(title, "Didn't find status element for " + data.statusorig);
                bookingState[title] = "error";
                throw new Error("Didn't find status element for " + data.statusorig);
            } 

            // Set form input elements
            let inputElems = form.getElementsByTagName("INPUT");
            for (let inputElem of inputElems) {
                if (inputElem.getAttribute("disabled") == "disabled")
                    continue;
                // set radio button checked
                if (inputElem.type == "radio" && data[inputElem.name])
                    inputElem.checked = (inputElem.value == data[inputElem.name]); 
                // set accept conditions button
                else if (inputElem["name"] == "tnbed")
                    inputElem.checked = true;
                else {
                    // fill form data
                    if (data[inputElem["name"]])
                        inputElem.value = data[inputElem["name"]];
                }
            }

            let submitButton = frameDoc.getElementById("bs_submit");
            console.assert(submitButton);

            // lever out countdown 
            // fastest way:
            iFrameElem.contentWindow.send = 1;
            submitButton.className = "sub";
            // other way:
            //iFrameElem.contentWindow.btime = -1; 
            //await sleep(1000);
            // Alternatively wait 7s until submitButton.className changed to sub to avoid attracting attention
            // while(submitButton.className != "sub")await sleep(100);

            // Check if should abort once more before submitting
            if (checkAbortFun()) {
                bookingState[title] = "ready";
                updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));
                console.log("Aborted booking for " + title);
                return;
            }

            // function called on the second submit screen (the Check Data screen) 
            iFrameElem.onload = async function(event) {
                let form = iFrameElem.contentDocument.forms[0];
                if (!form) {
                    updateEntryStateTitleErr(title, "Form not found");
                    bookingState[title] = "error";
                    console.warn("Error during booking of " + title + ": " + 
                        "Form on second screen not found!");
                    return;
                }
                // make form target external
                form.action = "/extern/" + form.action + "?referer=https://anmeldung.sport.uni-augsburg.de/cgi/anmeldung.fcgi";

                // find submit button and fill out confirm email address
                let inputElems = form.getElementsByTagName("INPUT");
                let submitButton; 
                for (let inputElem of inputElems) {
                    if (inputElem.title == "fee-based order") {
                        submitButton = inputElem;
                    } else if (inputElem.name.startsWith("email_check")) {
                        inputElem.value = data["email"];  
                    }
                }
                if (!submitButton) {
                    updateEntryStateTitleErr(title, "Submit button not found");
                    bookingState[title] = "error";
                    console.warn("Error during booking of " + title + ": " + 
                        "Submit button on second screen not found!");
                    return;
                }

                // Check if should abort once more before submitting
                if (checkAbortFun()) {
                    bookingState[title] = "ready";
                    updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));
                    console.log("Aborted booking for " + title);
                    return;
                }

                // function called on the third submit screen (the Confirmed Booking screen) 
                iFrameElem.onload = async function(event) {
                    // check if success screen appeared
                    if (iFrameElem.contentDocument.title == "Bestätigung") {
                        updateStatus("[SUCCESS] Booked course " + title);
                        updateEntryStateTitle(title, "Booking successful", "#00ff00");
                        bookingState[title] = "booked"; 

                        // let server know that course was booked successfully
                        upload("bookedcourses.txt", title+"\n", "text", true)
                        .then((bookedCourses) => {
                            console.log("Successfully informed server about successful booking.");
                            console.log("Booked courses: ");console.log(bookedCourses.split("\n"));
                        })
                        .catch((err) => {
                            console.warn("WARNING: Failed to inform server about successful booking"); 
                        })
                    } else {
                        updateStatus("[ERROR] Booking course " + title + " failed: no success screen");
                        updateEntryStateTitle(title, "Booking error", "red");
                        bookingState[title] = "error"; 
                    }
                };
                if (INACTIVE) {
                    submitButton.setAttribute("inert", "");
                    submitButton.setAttribute("hidden", "");
                    bookingState[title] = "error";
                    updateEntryStateTitle(title, "Booking test successful", "#00ff00");
                } else {
                    submitButton.setAttribute("inert", "");
                    //form.requestSubmit(submitButton);
                }
            };
            //TODO is sleep here necessary?
            //await sleep(1000);
            form.requestSubmit(submitButton);
        };

    form.requestSubmit(submitElem); 
}

async function waitUntilReadyAndBook(sport, checkAbortFun) {
    let titles = [];
    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            let t = `${sport}_${nr}_${user}`;
            // Check first if title is already ready or if function should wait for title
            if (["ready", "full", "booked", "wronguserid"].includes(bookingState[t]))
                bookCourse(t);
            else 
                titles.push(t);
        }
    }

    // set refreshtime so it immediately updates in the first loop
    let lastRefreshTime = Date.now() - refreshInterval_short;
    let refreshInterval = refreshInterval_short;
    while (titles.length > 0) {
        if (checkAbortFun()) {
            for (let t of titles) {
                updateEntryStateTitle(t, bookingState[t], getColorForBookingState(bookingState[t]));
            }
            console.log("aborted waitUntilReady(" + sport + ")");
            return;
        }

        if (Date.now() - lastRefreshTime >= refreshInterval) {
            lastRefreshTime = Date.now();
            let refreshIntervalId = setInterval(
                 () => {
                    for (let t of titles) {
                        updateTitleWithTime(t, timeout_msec - (Date.now() - lastRefreshTime), 
                            "Refresh (Timeout in ", ")");
                    }
                },
                statusUpdateInterval);
            await refreshSport(sport, titles)
                .catch( () =>  {
                // refresh again the next loop iteration by resetting the lastRefreshTime
                lastRefreshTime -= refreshInterval;
            });
            clearInterval(refreshIntervalId);

            // call book for any ready titles, for other titles (that are not missing or wrongnumber) continue to process them
            let newTitles = [];
            for (let t of titles) {
                if (["ready", "full", "booked", "wronguserid"].includes(bookingState[t])) {
                    bookCourse(t);
                } else if (!["missing", "wrongnumber"].includes(bookingState[t])) {
                    newTitles.push(t);
                    // adapt interval depending on how long until the course becomes ready 
                    let remainingTime = getRemainingTimeMS(bookingTime[t]);
                    if (remainingTime && remainingTime > timeThreshold_short) {
                        if (remainingTime > timeThreshold_mid) 
                            refreshInterval = Math.min(refreshInterval_long, remainingTime - timeThreshold_mid);
                        else
                            refreshInterval = Math.min(refreshInterval_mid, remainingTime - timeThreshold_short);
                    } else {
                        refreshInterval = refreshInterval_short;
                    }
                } 
            }
            titles = newTitles;
        } else {
            for (let t of titles) {
                let statusStr = bookingTime[t] ? getRemainingTimeString(bookingTime[t]) + "<br>" : ""; 
                updateTitleWithTime(t, refreshInterval - (Date.now() - lastRefreshTime), 
                            statusStr + "Refreshing in ", "...");
            }         
            // sleep for statusUpdateInterval ms or until the next refresh happens 
            await sleep(Math.min(statusUpdateInterval, lastRefreshTime + refreshInterval - Date.now())); 
        }
    }
    console.log("waitUntilReady(" + sport + ") done");
}

async function arm() {
    if (courses.length == 0 || !choice) {
        updateStatus("Arming failed: List of courses and Choice not loaded");
        return;
    }

    toggleButtonsInert(["arm", "unarm", "loadchoice", "refreshchoice", "chkuserdata", "chkcourses"]);

    // stop status update interval
    if (allStatusInterval)
        clearInterval(allStatusInterval);
    allStatusInterval = undefined;

    updateStatus("Armed.");

    let currentArmID = armID;
    checkAbortFun = () => armID != currentArmID;

    // check if all elements are valid
    for (let sport of Object.keys(choice)) {
        for (let user of Object.keys(choice[sport])) {
            for (let nr of choice[sport][user]) {
                const title = `${sport}_${nr}_${user}`;
                if (!userdata[user]) {
                    updateEntryStateTitleErr(title, "No Userdata. Cannot book course");
                }
            }
        }
    } 

    for (let sport of Object.keys(choice)) {
        waitUntilReadyAndBook(sport, checkAbortFun)
        .catch(
            (error) => {
                console.error("Error in waitUntilReady: " + error.message);
            });
    }

    let intervalID = setInterval(() => {
        let bookingDone = checkBookingDone();
        // if checkAbortfun is true, unarm has already been called
        if (bookingDone && !checkAbortFun())
            unarm();
        if (bookingDone || checkAbortFun())
            clearInterval(intervalID); 
    }, 500); 
}

async function unarm() {
    armID += 1;
    toggleButtonsInert(["arm", "unarm", "loadchoice", "refreshchoice", "chkuserdata", "chkcourses"]);
    startAllStatusInterval();
    updateStatus("Unarmed.");
}

function checkBookingDone() {
    for (let title of Object.keys(bookingState)) {
        if (!["booked", "full", "missing", "wrongnumber", "wronguserid", "error"].includes(bookingState[title])) {
            //console.log("Booking not done: " + title + " " + bookingState[title]);
            return false;
        }
    }
    return true;
}

function updateEntryStateTitleErr(title, err) {
    updateEntryStateTitle(title, "ERROR: " + err, "darkorange");
    updateStatus("[ERROR] booking " + title + ": " + err);
}

function updateEntryStatesSport(sport, state, color="white") {
    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            updateEntryState(sport, nr, user, state, color);
        }
    }
}

function updateEntryState(sport, nr, user, state, color="white") {
    const title = `${sport}_${nr}_${user}`;
    updateEntryStateTitle(title, state, color); 
}

function updateEntryStateTitle(title, state, color="white") {
    const statusElem = statusElements[title];
    if (!statusElem) {
        console.error("[ERROR] updating Status: status element " + title + " missing");
        return;
    }
    let style = "height:30px; width: 250px; font-weight: bold; text-align: center;"
        + "background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = state;
}

async function updateEntryInTable(entryHTML, sport, nr, user, BS_Code) {
    const title = `${sport}_${nr}_${user}`;

    let entryElem;
    // check if nr is already in table
    for (let tableEntry of document.getElementById("choice").children) {
        if (tableEntry.getAttribute("title") == title) {
            entryElem = tableEntry;
            break;
        }
    }
    // if not, create new table entry
    if (!entryElem) {
        let choiceElem = document.getElementById("choice");
        const availElem = document.getElementById("avail");
        choiceElem.appendChild(availElem.children[0].cloneNode(true));
        entryElem = choiceElem.lastChild;
        entryElem.setAttribute("title", title);
    }

    // replace tableRow with entryHTML input appended with the old status bar 
    const rowElem = entryElem.getElementsByTagName("TR")[1];
    // clear row for 100msec for visual effect of refresh
   for (let cell of rowElem.children)
       cell.setAttribute("style", "color: white;");
    await sleep(100);
    const statusElem = entryElem.getElementsByClassName("nr_name")[0];
    rowElem.innerHTML = entryHTML + statusElem.outerHTML;

    statusElements[title] = rowElem.getElementsByClassName("nr_name")[0];
    updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));

    // update form:
    // update BS_Code
    let inputTableBS = entryElem.getElementsByTagName("INPUT")[0];
    console.assert(inputTableBS.name == "BS_Code");
    inputTableBS.value = BS_Code;

    // update form target
    let formElem = entryElem.children[0];
    console.assert(formElem.tagName == "FORM");
    formElem.target = "frame_"+title;
    // update action
    formElem.action += `?referer=${HSA_LINK+courses[sport]}`; 
}


async function refreshSport(sport, updateTitles=[]) {
    let doc;
    if (courses[sport]) {
        let link = HSA_LINK + courses[sport];
        try {
            doc = await requestHTML("GET", "extern/" + link);
            updateStatus("Fetched HTML site for " + sport);
        } catch (err) {
            updateStatus("[ERROR] Course " + sport + " HTML request failed : " + JSON.stringify(err));
            for (let user of Object.keys(choice[sport])) {
                for (let nr of choice[sport][user])  {
                    let title = `${sport}_${nr}_${user}`;
                    if (bookingState[title] != "booked") {
                        bookingState[title] = "failed";
                    }
                    delete bookingTime[title];
                    entryElem = getErrorTable(nr, `[${nr}] ${sport} (${user})`, "Page load failed");
                    updateEntryInTable(entryElem, sport, nr, user, "None"); 
                }
            }
            throw err;
        }
    } else {
        for (let user of Object.keys(choice[sport])) {
            for (let nr of choice[sport][user])  {
                let title = `${sport}_${nr}_${user}`;
                if (bookingState[title] != "booked") {
                    bookingState[title] = "missing";
                }
                entryElem = getErrorTable(nr, `[${nr}] ${sport} (${user})`, "Course missing");
                updateEntryInTable(entryElem, sport, nr, user, "None");
            }
        }
        throw new Error("Course " + sport + " missing");
    }

    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            let entryElem;
            let title = `${sport}_${nr}_${user}`;
            let BS_Code = "None";

            // find number in loaded doc
            let nums = doc.getElementsByClassName("bs_sknr");
            let n = undefined;
            for (let item of nums) 
                if (item.innerHTML == nr) {
                    n = item;
                    break;
                }

            if (!n) {
                entryElem = getErrorTable(nr, sport + ` (${user})`, "Wrong Number");
                bookingState[title] = "wrongnumber";
            } else {
                let detailStr = n.parentElement.getElementsByClassName("bs_sdet")[0].innerHTML;
                detailStr = detailStr.indexOf("-") >= 0 ? detailStr.substr(0, detailStr.indexOf("-") - 1): detailStr;
                n.parentElement.getElementsByClassName("bs_sdet")[0].innerHTML = detailStr + ` - ${sport} (${user})`;

                // get BS_Code
                let formElem = n.parentElement;
                while (formElem.tagName != "FORM")
                    formElem = formElem.parentElement;
                let inputBS = formElem.getElementsByTagName("INPUT")[0];
                console.assert(inputBS.name == "BS_Code");
                BS_Code = inputBS.value;

                entryElem = n.parentElement.innerHTML;

                // check booking button if not already booked
                if (bookingState[title] != "booked") {
                    let bookElem = n.parentElement.getElementsByClassName("bs_sbuch")[0];
                    let bookButton = bookElem.getElementsByTagName("INPUT")[0];
                    switch (bookButton ? bookButton.className : "") {
                        case "bs_btn_buchen":
                            bookingState[title] = "ready";
                            break;
                        case "bs_btn_ausgebucht":
                        case "bs_btn_warteliste":
                            bookingState[title] = "full";
                            break;
                        default:
                            bookingState[title] = "none";
                            let bookTimeElems = bookElem.getElementsByClassName("bs_btn_autostart");
                            if (bookTimeElems.length > 0) {
                                bookingTime[title] = bookTimeElems[0].innerHTML;
                            } else {
                                delete bookingTime[title];
                            }
                    }
                    if (!userdata[user]){
                        updateStatus("ERROR: userdata for " + user + " not found");
                        bookingState[title] = "wronguserid";
                    }
                        }
                    }
            if (updateTitles.length == 0 || updateTitles.includes(title))
                updateEntryInTable(entryElem, sport, nr, user, BS_Code);
        }
    }
}

async function refreshChoice() {
    updateStatus("Refreshing course status...");

    if (!choice) 
        await loadChoice();

    let updatedSports = [];
    let updateCheckerInterval = setInterval(
        async function() {
            if (updatedSports.length == Object.keys(choice).length) {
                clearInterval(updateCheckerInterval);
                updateStatus("Refreshed course status.");
            }
        },
        500
    )

    for (let sport of Object.keys(choice)) {
        let startTime = Date.now();
        let intervalID = setInterval(
            () => { 
                for (let user of Object.keys(choice[sport])) 
                    for (let nr of choice[sport][user]) 
                        updateTitleWithTime(`${sport}_${nr}_${user}`, timeout_msec - (Date.now() - startTime),
                             "Refresh (Timeout in ", ")");
            }, statusUpdateInterval);

        refreshSport(sport)
        .catch((err) => {console.error(err)})
        .finally(() => {
            updatedSports.push(sport);
            clearInterval(intervalID);
            startAllStatusInterval();
        });
    }
}

// starts countdown until booking time for all tasks
function startAllStatusInterval() {
    if (allStatusInterval)
        clearInterval(allStatusInterval);
    
    // setup interval function to regularly update the time until booking becomes available for every title
    allStatusInterval = setInterval(
        () => { 
            for (let sport of Object.keys(choice)) {
                for (let user of Object.keys(choice[sport])) {
                    for (let nr of choice[sport][user]) { 
                        let title =  `${sport}_${nr}_${user}`;
                        let remainingTime = getRemainingTimeString(bookingTime[title]);
                        if (remainingTime) 
                            updateEntryStateTitle(title, remainingTime);
                    }
                }
            }
        }, 500);
}


function loadChoice() {
    updateStatus("Loading choice and user data...");
    return download(USERS_FILE)
    .then((data) => {
        userdata = data;
        updateStatus("Loaded user data.");
        console.log(userdata);
    })
    .catch( (err) => {
        updateStatus("Failed to load user data");
        console.error("Failed to load user data:")
        console.error(err)
    })
    .then(() => download(CHOICE_FILE))
    .then(async (data) => {
        choice = data;
        console.log(choice);
        updateStatus("Loaded choice.");

        let frameRootElem  = document.getElementById("formframes");
        frameRootElem.innerHTML = "";

        // Remove tables and create table entry for each choice
        let leftRightCounter = 0;
        document.getElementById("choice").innerHTML = "";
        for (let sport of Object.keys(choice)) {
            for (let user of Object.keys(choice[sport])) {
                for (let nr of choice[sport][user]) {
                    let title = `${sport}_${nr}_${user}`;
                    let entryElem = getErrorTable(nr, title, "init");
                    updateEntryInTable(entryElem, sport, nr, user, "None"); 

                    // Create iframe for booking; one one the left side, the next on the right side
                    let htmlFrame = 
                        `<div style="display:inline-block;">` +
                        `<div style="text-align:center;font-weight:bold">`+title+"</div>"+
                        `<iframe width="600" height="600" title="Anmeldung ${title}" name="frame_${title}" style="overflow:scroll;" referrerpolicy="no-referrer">
                        </iframe><div>`;
                    frameRootElem.innerHTML += htmlFrame; 
                }
            }
        }
    })
    .catch( (err) => {
        document.getElementById("choice").innerHTML = "";
        updateStatus("Failed to load choice data");
        console.error("Failed to load choice data:")
        console.error(err)
    })
    .then(() => upload("bookedcourses.txt", "",  "text", true)) // upload with append to create the file if it doesnt exist
    .then((bookedList) => {
        // set state of titles in bookedList to booked
        let bookedArr = bookedList.split("\n");
        for (let title of bookedArr) {
            if (title != "") {
                bookingState[title] = "booked";
                updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));
            }
        } 
    })
    .catch((err) => {
       console.log("Failed to load file bookedcourses.txt");
    });
}


function loadCourses() {
    updateStatus("Loading courses...");

    return requestHTML("GET",
            "/extern/" + HSA_LINK 
        ).then (  
            (doc) => {
                let rootElems = doc.getElementsByClassName("bs_menu");
                for (let rootElem of rootElems) {
                    for (let elem of rootElem.getElementsByTagName("A")) {
                        courses[elem.innerHTML] = elem.href.split("/").pop();
                    }
                }
                updateStatus("Loaded courses.");
            },
            (err) => {
                updateStatus("Loading courses failed: " + JSON.stringify(err));
            }
        );
}

function onCloseButton(button) {
    let parent = button.parentElement;
    while (parent.id != "bs_content") {
        parent = parent.parentElement;
    }
    let title = parent.title;
    let [sport, nr, user] = title.split("_");
    let longTitle = `${sport} - ${nr} (${user})`;

    if (choice[sport] && choice[sport][user] && choice[sport][user].includes(nr) && confirm(`Remove course ${longTitle}?`)) {
        delete bookingState[title];
        choice[sport][user].splice(choice[sport][user].indexOf(nr), 1);
        if (choice[sport][user].length == 0) {
            delete choice[sport][user];
            if (Object.keys(choice[sport]).length == 0)
                delete choice[sport];
        }
        // update choice file
        upload(CHOICE_FILE, choice)
        .then((data) => { 
            choice = data;
            if (!choice[title]) {
                // remove choice element
                parent.parentElement.removeChild(parent);
                // remove iframe
                let frameRootElem  = document.getElementById("formframes");
                for (let child of frameRootElem.children) { 
                    let iFrameChild = child.getElementsByTagName("IFRAME")[0];
                    if (iFrameChild.name == "frame_" + title) { 
                        frameRootElem.removeChild(child);
                        break;
                    }
                }
                updateStatus("Successfully removed course " + longTitle);
            } else {
                updateStatus("Failed to remove course " + longTitle);

            }
            console.log("New choice:")
            console.log(choice);
        })
        .then (() => {
            // update bookedcourses file
            console.log("Trying to remove course " + title + " from bookedcourses file...");
            return download("bookedcourses.txt", "text")
            .then((bookedCourses) => {
                // set state of titles in bookedList to booked
                let bookedTitles = bookedCourses.split("\n");
                console.log("Current bookedcourses:")
                console.log(bookedTitles);
                for (let i = 0; i < bookedTitles.length; i++) {
                    // remove any whitespace titles
                    if (bookedTitles[i].match(/^\s*$/))  {
                        bookedTitles.splice(i, 1);
                        i--;
                    } else if (bookedTitles[i] == title ) {
                        // once the title was found, remove and upload, then return
                        bookedTitles.splice(i, 1);
                        upload("bookedcourses.txt", bookedTitles.join("\n"), "text")
                        .then( (bookedCourses) => { 
                            console.log("Updated bookedcourses: ");
                            console.log(bookedCourses.split("\n"));
                        })
                        .catch((err) => {
                            console.error("Failed to update bookedcourses file: ");
                            console.error(err);
                        });
                        return;
                    }
                }
                console.log("Course " + title + " was not stored in bookedcourses file: No update necessary");
            })
            .catch((err) => {
                console.log("bookedcourses file does not exist");
            });
        })
        .catch((err) => { // catch function for choice upload
            console.error("[ERROR] : failed to remove " + longTitle);
            updateStatus("Failed to remove chosen course" + longTitle);
        });
    }

    return false;
}

function toggleButtonsInert(buttonIDs, inert) {
    for (let id of buttonIDs) {
        document.getElementById(id).toggleAttribute("inert");
    }
}


document.getElementById("loadchoice").addEventListener("click", () => loadChoice().then(refreshChoice));
document.getElementById("refreshchoice").addEventListener("click", refreshChoice);
document.getElementById("arm").addEventListener("click", arm);
document.getElementById("unarm").addEventListener("click", unarm);
document.getElementById("clearstatus").addEventListener("click", () => updateStatus("", "clear"));

toggleButtonsInert(["unarm",]);

document.getElementById("debug").addEventListener("click", () => {
    if (HSA_LINK == HSA_LINK_new) {
        HSA_LINK = HSA_LINK_old;
    } else {
        HSA_LINK = HSA_LINK_new;
    }
    console.debug("Switched HSA_LINK to " + HSA_LINK);
});


// Load data initially 
loadCourses()
.then(loadChoice)
.then(refreshChoice)
.catch((error) => console.error("Load and refresh of choice failed: " + error.message));

if (INACTIVE)
    document.title += " - inactive";
