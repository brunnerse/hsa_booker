const HSA_LINK_new = "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/";
//const HSA_LINK_old = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"
const HSA_LINK_old = "http://localhost/"
var HSA_LINK = HSA_LINK_new;


const refreshInterval_short = 2000;
const refreshInterval_mid = 5000;
const refreshInterval_long = 30000;
const timeout_msec = 10000;

var statusInterval;

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
        "failed": "gray", "wrongnumber": "orange", "none": "white"};
    if (colors[bookingState])
        return colors[bookingState];
    return "white";
}

function sleep(msec) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, msec);
    })
}

function getRemainingTimeMS(timeStr) {
    timeStr = timeStr.replace("ab ", "");
    let arr = timeStr.split(",");
    let day = arr[0].split(".")[0];
    let month = arr[0].split(".")[1];
    let year = new Date(Date.now()).getUTCFullYear();
    let bookDate = new Date(`${year}-${month}-${day}T${arr[1].replace(" ", "")}`);

    return bookDate - new Date(Date.now());
}

function getRemainingTimeString(timeStr) {
    let remainMS = getRemainingTimeMS(timeStr);
    let remDays = Math.floor(remainMS / (1000 * 60 * 60 * 24));
    remainMS -= remDays * (1000 * 60 * 60 * 24);
    let remHours = Math.floor(remainMS / (1000 * 60 * 60));
    remainMS -= remHours * (1000 * 60 * 60);
    let remMins = Math.floor(remainMS / (1000 * 60));
    remainMS -= remMins * (1000 * 60);
    let remSecs = Math.floor(remainMS / (1000));

    s = ""
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
    const notAvailElem = document.getElementById("notavail");
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
        `${Math.round(time_msec / 100)/10}` + postMsg,
        "#ffff00");
}

async function bookCourse(title) {
    console.log("bookCourse " + title + " state " + bookingState[title]);
    
    if (bookingState[title] == "booked") {
        updateEntryStateTitle(title, "Already booked", "#00ff00");
        return;
    } else if (bookingState[title] != "ready") {
        console.log("Booking failed: " + bookingState[title]);
        updateEntryStateTitle(title, "Booking failed: " + bookingState[title], "red");
        return;
    }

    bookingState[title] = "booking";
    updateStatus("Booking course " + title);
    updateEntryStateTitle(title, "Started booking...", "blue");
    
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
    let formElem = statusElements[title].parentElement;
    while (formElem.tagName != "FORM") 
        formElem = formElem.parentElement;
    // find input element for button
    let submitElem = formElem.getElementsByTagName("INPUT")[1];
    console.assert(submitElem.type == "submit");

    iFrameElem.onload = 
        async function (event) { 
            console.log("First onload function");
            let frameDoc = iFrameElem.contentDocument;
            console.log(title + " iFrame content:")
            console.log(frameDoc);

            let user = title.split("_")[2];
            console.log(userdata);
            let data = userdata[user];
            if (!data){
                updateEntryStateTitleErr(title, "userdata for " + user + " not found");
                bookingState[title] = "error";
                throw new Error("ERROR: userdata for " + user + " not found!");
            }

            // Fill form and submit
            let form = frameDoc.getElementsByTagName("FORM")[0];
            // make form target external
            form.action = "/extern/" + form.action + "?referer=https://anmeldung.sport.uni-augsburg.de/cgi/anmeldung.fcgi";
            // Set status select option
            let selectElem = form.getElementsByTagName("SELECT")[0];
            console.assert(form.getElementsByTagName("SELECT").length == 1);
            await sleep(1000);
            let ok = false;
            for (let i = 0; i < selectElem.options.length; i++) {
                if (selectElem.options[i].value == data.statusorig) {
                    selectElem.selectedIndex = i;
                    selectElem.dispatchEvent(new Event("change"));
                    ok = true;
                    break;
                }
            }
            // Make event change or call fun manually
            if (!ok) {
                updateEntryStateTitleErr(title, "Didn't find status element for " + data.statusorig);
                bookingState[title] = "error";
                throw new Error("Didn't find status element for " + data.statusorig);
            } 


            // Set form input elements
            let inputElems = form.getElementsByTagName("INPUT");
            for (let inputElem of inputElems) {
                // set sex radio button
                if (inputElem["name"] == "sex" && inputElem.value == data["sex"])
                    inputElem.checked = true; 
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

            iFrameElem.onload = async function(event) {
                console.log("Onload called inner");
                let frameDoc = iFrameElem.contentDocument; 
                let form = frameDoc.getElementsByTagName("FORM")[0];
                // make form target external
                form.action = "/extern/" + form.action + "?referer=https://anmeldung.sport.uni-augsburg.de/cgi/anmeldung.fcgi";

                let inputElems = form.getElementsByTagName("INPUT");
                let submitButton; 
                for (let inputElem of inputElems) {
                    if (inputElem.title == "fee-based order") {
                        submitButton = inputElem;
                        break;
                    }
                }
                if (!submitButton) {
                    updateEntryStateTitleErr(title, "Submit button not found");
                    bookingState[title] = "error";
                    throw new Error("Submit button on second screen not found!");
                }
                iFrameElem.onload = async function(event) {
                    console.log("Onload called second inner");
                    //TODO check if success screen appeared
                    if (false)
                        throw new Error();
                    updateStatus("[SUCCESS] Booked course " + title);
                    updateEntryStateTitle(title, "Booking successful", "#00ff00");
                    bookingState[title] = "booked"; 
                    // let server know that course was booked successfully
                    let xhr = new XMLHttpRequest();
                    xhr.onerror = () => {
                        console.log("WARNING: Failed to inform server about successful booking"); 
                    };
                    xhr.onloadend = () => {
                    let bookedCourses = xhr.response;
                        console.log("Successfully informed server about successful booking.");
                        console.log("Booked courses: " + bookedCourses);
                    };
                    xhr.responseType = "text";
                    xhr.open("GET","bookedcourses.txt?append="+title);
                    xhr.send();
                };

                if (checkAbortFun()) {
                    bookingstate[title] = "ready";
                    updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));
                    throw new Error ("Aborted booking for " + title);
                }
                //TODO this button iff sure!!!
                submitButton.setAttribute("inert", "");
                submitButton.setAttribute("hidden", "");
                //form.requestSubmit(submitButton);
            };
            // lever out countdown 
            iFrameElem.contentWindow.btime = -1; 
            // Alternatively wait until submitButton.className changed to sub to avoid attraction attention
            //await sleep(7200);
            // TODO remove sleep
            await sleep(2000);
            // Check if should abort
            if (checkAbortFun()) {
                bookingState[title] = "ready";
                updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));
                throw new Error ("Aborted booking for " + title);
            }
            form.requestSubmit(submitButton);
            console.log("Submitted " + title + "...");
        };

    formElem.requestSubmit(submitElem); 
}

async function waitUntilReadyAndBook(sport, checkAbortFun) {
    let titles = [];
    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            let t = `${sport}_${nr}_${user}`;
            // Check first if title is already ready or if function should wait for title
            if (["ready", "full", "booked"].includes(bookingState[t]))
                bookCourse(t);
            else 
                titles.push(t);
        }
    }

    console.log("Waiting until ready for " + sport +"\t" + titles);


    // set refreshtime so it immediately updates in the first loop
    let lastRefreshTime = Date.now() - refreshInterval_short;
    let refreshInterval = refreshInterval_short;
    while (titles.length > 0) {
        if (checkAbortFun()) {
            for (let t of titles) {
                updateEntryStateTitle(t, bookingState[t], getColorForBookingState(bookingState[t]));
            }
            throw new Error("aborted waitUntilReady(" + sport + ")");
        }

        if (Date.now() - lastRefreshTime >= refreshInterval) {
            lastRefreshTime = Date.now();
            if (statusInterval)
                clearInterval(statusInterval);
            statusInterval = setInterval(
                 () => {
                    for (let t of titles) {
                        updateTitleWithTime(t, timeout_msec - (Date.now() - lastRefreshTime), 
                            "Refresh (Timeout in ", ")");
                    }
                },
                250);
            await refreshSport(sport, titles);
            clearInterval(statusInterval);
            statusInterval = undefined;
            // call book for any ready titles
            let newTitles = [];
            for (let t of titles) {
                if (["ready", "full", "booked"].includes(bookingState[t])) {
                    bookCourse(t);
                } else if (!["missing", "wrongnumber"].includes(bookingState[t])) {
                    newTitles.push(t);
                    // adapt interval depending on how long until the course becomes ready 
                    // TODO only for last title, not for all? Shouldn't make difference, just wasting performance
                    if (bookingTime[t] && getRemainingTimeMS(bookingTime[t]) > 30 * 1000) {
                        if (getRemainingTimeMS(bookingTime[t]) > 5*60*1000) 
                            refreshInterval = refreshInterval_long;
                        else
                            refreshInterval = refreshInterval_mid;
                    } else {
                        refreshInterval = refreshInterval_short;
                    }
                } 
            }
            titles = newTitles;
        } else {
            for (let t of titles) {
                let statusStr = bookingTime[t] ? getRemainingTimeString(bookingTime[t]) + "<br>" : ""; 
                updateTitleWithTime(t, refreshInterval_short - (Date.now() - lastRefreshTime), 
                            statusStr + "Refreshing in ", "...");
            }         
            // sleep for a quarter second
            await sleep(250); 
        }
    }
    console.log("waitUntilReady for " + sport + " done");
}

async function arm() {
    updateStatus("Arming...", "append");

    toggleButtonsInert(["arm", "unarm", "refreshchoice"]);

    if (courses.length == 0 || !choice) {
        updateStatus("Arming failed: List of courses and Choice not loaded", "replace");
        return;
    }

    let currentArmID = armID;
    checkAbortFun = () => {return armID != currentArmID;};

    const choiceElement = document.getElementById("choice");

    for (let sport of Object.keys(choice)) {
        waitUntilReadyAndBook(sport, checkAbortFun)
        .catch(
            (error) => {
                console.log("Error in waitUntilReady: " + error.message);
            });
    }
    updateStatus("Armed.", "replace");

    let intervalID = setInterval(() => {
        //console.log("Checking if booking is done to unarm automatically...");
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
    updateStatus("Unarmed.", "append");
    toggleButtonsInert(["arm", "unarm", "refreshchoice"]);
}

function checkBookingDone() {
    for (let title of Object.keys(bookingState)) {
        if (!["booked", "full", "missing", "wrongnumber", "error"].includes(bookingState[title])) {
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
    let choiceElem = document.getElementById("choice");
    const statusElem = statusElements[title];
    if (!statusElem) {
        console.log("[ERROR] updating Status: status element " + title + " missing");
        return;
    }
    let style = "height:30px; width: 250px; font-weight: bold; text-align: center;"
        + "background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = state;
}

function updateEntryInTable(entryHTML, sport, nr, user, BS_Code) {
    const title = `${sport}_${nr}_${user}`;

    const availElem = document.getElementById("avail");
    let entryElem;
    // check if nr is already in table
    let found = false;
    for (let tableEntry of document.getElementById("choice").children) {
        if (tableEntry.getAttribute("title") == title) {
            found = true;
            tableEntry.innerHTML = availElem.children[0].innerHTML;
            entryElem = tableEntry;
            break;
        }
    }
    if (!found) {
        let choiceElem = document.getElementById("choice");
        choiceElem.innerHTML += availElem.innerHTML;
        entryElem = choiceElem.children[choiceElem.children.length-1];
        entryElem.setAttribute("title", title);
    }

    // replace tableRow with entryHTML input appended with the old status bar 
    const rowElem = entryElem.getElementsByTagName("TR")[1];
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
                    entryElem = getErrorTable(nr, sport + ` (${user})`, "Page load failed");
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
                entryElem = getErrorTable(nr, sport + ` (${user})`, "Course missing");
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

            let alreadyBooked = bookingState[title] == "booked";

            // find number in loaded doc
            let nums = doc.getElementsByClassName("bs_sknr");
            let n = undefined;
            console.log(typeof(nums));
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
                //TODO should be unnecessary
                let idx = detailStr.indexOf('-');
                idx = idx >= 0 ? idx : detailStr.length;
                detailStr = detailStr.substr(0, idx);
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
                }
            }
            if (updateTitles.length == 0 || updateTitles.includes(title))
                updateEntryInTable(entryElem, sport, nr, user, BS_Code);
        }
    }
}

async function refreshChoice() {
    updateStatus("Refreshing choice course status...");

    if (!choice) {
        loadChoice();
        return;
    }

    let updatedSports = [];
    let updateCheckerInterval = setInterval(
        async function() {
            if (updatedSports.length == Object.keys(choice).length) {
                clearInterval(updateCheckerInterval);
                updateStatus("Refreshed choice course status.");
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
            }, 100);

        refreshSport(sport).finally(() => {
            console.log(statusElements);
            console.log("Sport " + sport);
            updatedSports.push(sport);
            clearInterval(intervalID);
        
            if (statusInterval)
                clearInterval(statusInterval);
            statusInterval = setInterval(
                () => { 
                    for (let sport of Object.keys(choice)) {
                        for (let user of Object.keys(choice[sport])) {
                            for (let nr of choice[sport][user]) { 
                                let title =  `${sport}_${nr}_${user}`;
                                if (bookingTime[title]) 
                                    updateEntryStateTitle(title, getRemainingTimeString(bookingTime[title]));
                            }
                        }
                    }
                }, 1000);
        });
    }
}


function loadChoice() {
    updateStatus("Loading choice...", "append");

    return new Promise(function (resolve, reject) {
        if (courses.length == 0) {
            updateStatus("Loading choice failed: List of courses not loaded", "replace");
            reject();
        }
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            document.getElementById("choice").innerHTML = "failed ";
            reject(err);
        };
        xhr.onloadend = () => {
            choice = xhr.response;
            console.log("Loaded choice.")
            console.log(choice);
            
            let frameRootElem  = document.getElementById("formframes");
            frameRootElem.innerHTML = "";

            // Remove tables and create table entry for each choice
            let leftRightCounter = 0;
            document.getElementById("choice").innerHTML = "";
            for (let sport of Object.keys(choice)) {
                for (let user of Object.keys(choice[sport])) {
                    for (let nr of choice[sport][user]) {
                        entryElem = getErrorTable(nr, sport + ` (${user})`, "init");
                        updateEntryInTable(entryElem, sport, nr, user, "");

                        // Create iframe for booking
                        let title = `${sport}_${nr}_${user}`;
                        let htmlFrame = 
                            `<div style="align:center;float:${leftRightCounter++ % 2 == 0 ? "left" : "right"};">`+title+"<br>"+
                            `<iframe width="600" height="600" title="Anmeldung ${title}" name="frame_${title}" style="overflow:scroll;">
                            </iframe><div>`;
                       frameRootElem.innerHTML += htmlFrame; 
                    }
                }
            }
            updateStatus("Loaded choice.", "replace");

            // Get list of already booked courses and set their bookingState
            let xhr_booked = new XMLHttpRequest();
            xhr_booked.onloadend = () => {
                if (xhr_booked.status == 404) {
                    console.log("bookedcourses file does not exist");
                } else {
                    let bookedList = xhr_booked.response;
                    console.log("booked courses: " + bookedList);
                    let bookedArr = bookedList.split("\n");
                    for (let title of bookedArr) {
                        if (title != "") {
                            bookingState[title] = "booked";
                            updateEntryStateTitle(title, "Booked", "#00ff00");
                        }
                    } 
                }
            }
            xhr_booked.onerror = () => console.log("ERROR: Request to load bookedcourses.txt list failed");

            xhr_booked.responseType = "text";
            xhr_booked.open("GET", "bookedcourses.txt");
            xhr_booked.send();

            resolve();
        }
        xhr.open("GET","choice.json");
        xhr.responseType = "json";
        xhr.send();
    });
}

function loadUserData() {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed loading user data");
            updateStatus("LoadUserData failed!");
            reject(err);
        };
        xhr.onloadend = () => {
            console.log(xhr.status);
            if (xhr.status == "404")
                throw new Error("404: userdata.json not found on server");
            updateStatus("Loaded user data.");
            userdata = xhr.response;
            console.log("Loaded user data:")
            console.log(userdata);
            
            resolve(userdata);
        }
        xhr.open("GET","userdata.json");
        xhr.responseType = "json";
        xhr.send();
    });

}


function loadCourses() {
    updateStatus("Loading courses...", "append");

    return requestHTML("GET",
            "/extern/" + HSA_LINK 
        ).then (  
            (doc) => {
                let rootElems = doc.getElementsByClassName("bs_menu");
                for (let rootElem of rootElems) {
                    for (let elem of rootElem.getElementsByTagName("A")) {
                        //console.log(`${elem.innerHTML} -> ${elem.href}`);
                        let idx = elem.href.lastIndexOf("/");
                        courses[elem.innerHTML] = elem.href.substr(idx+1);
                    }
                }
                document.getElementById("courses").innerHTML = 
                    "<div class=\"col-xs-12 content noPadRight\">"+
                    doc.getElementsByClassName("item-page")[0].innerHTML
                    +"</div>" ;

                console.log("Available courses: " + Object.keys(courses));
                updateStatus("Loaded courses.", "replace");
            },
            (err) => {
                //  document.getElementById("courses").innerHTML = "failed ";
                updateStatus("Loading courses failed: " + JSON.stringify(err), "append");
            }
        );
}

function toggleButtonsInert(buttonIDs, inert) {
    for (let id of buttonIDs) {
        document.getElementById(id).toggleAttribute("inert");
    }
}


document.getElementById("loadcourses").addEventListener("click", loadCourses);
document.getElementById("loadchoice").addEventListener("click", loadChoice);
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
    console.log("Switched HSA_LINK to " + HSA_LINK);
});


// Load data initially 
loadChoice().then( 
        loadCourses().then(refreshChoice).catch((error) => console.log("Initial loading failed: " + error.message)));

// Load user data initially
const userDataInterval = setInterval( async () => {
    try {await loadUserData(); clearInterval(userDataInterval);} catch (e) {}
}, 1000);