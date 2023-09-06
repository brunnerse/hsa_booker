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
    let colors = {"booked" : "green", "booking" : "blue", "ready" : "aqua", 
        "full": "red", "missing": "maroon",
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

function getRemainingTimeString(timeStr) {
    timeStr = timeStr.replace("ab ", "");
    let arr = timeStr.split(",");
    let day = arr[0].split(".")[0];
    let month = arr[0].split(".")[1];
    let year = new Date(Date.now()).getUTCFullYear();
    let bookDate = new Date(`${year}-${month}-${day}T${arr[1].replace(" ", "")}`);

    let remainMS = bookDate - new Date(Date.now());

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
        updateEntryStateTitle(title, "Already booked", "green");
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
    iFrameElem.onload = 
    async function (event) { 

        let frameDoc = iFrameElem.contentDocument;
        console.log(title + " iFrame content:")
        console.log(frameDoc);

        let user = title.split("_")[2];
        let data = userdata[user];
        if (!data){
            throw new Error("ERROR: userdata for " + user + " not found!");
        }

        // TODO fill form and submit 
        await sleep(3000);


        updatedStatus("[SUCCESS] Booked course " + title);
        updateEntryStateTitle(title, "Booking successful", "green");
        bookingState[title] = "booked"; 

        // let server know that course was booked successful
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
        xhr.open("GET","/appendFile/?file=bookedcourses.txt&text="+title);
        xhr.send();
    };

    // find form element for course
    let formElem = statusElements[title].parentElement;
    while (formElem.tagName != "FORM") 
        formElem = formElem.parentElement;
    // find input element for button
    let submitElem = formElem.getElementsByTagName("INPUT")[1];
    console.assert(submitElem.type == "submit");
    formElem.requestSubmit(submitElem); 

}

async function waitUntilReadyAndBook(sport, checkAbortFun) {
    let titles = [];
    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            titles.push(`${sport}_${nr}_${user}`);
        }
    }

    console.log("Waiting until ready for " + sport +"\t" + titles);


    // set refreshtime so it immediately updates in the first loop
    let lastRefreshTime = Date.now() - refreshInterval_short;
    while (titles.length > 0) {
        if (checkAbortFun()) {
            for (let t of titles) {
                updateEntryStateTitle(t, bookingState[t], getColorForBookingState(bookingState[t]));
            }
            throw new Error("aborted waitUntilReady(" + sport + ")");
        }

        // TODO use different interval depending on time left

        if (Date.now() - lastRefreshTime >= refreshInterval_short) {
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
                    console.log(Date.now() + " Calling book for " + t + " " + titles.indexOf(t));
                    bookCourse(t);
                } else if (!["missing", "wrongnumber"].includes(bookingState[t])) {
                    newTitles.push(t);
                }
            }
            titles = newTitles;
        } else {
            for (let t of titles) {
                updateTitleWithTime(t, refreshInterval_short - (Date.now() - lastRefreshTime), 
                            "Refreshing in ", "...");
            }         
            // sleep for a  second
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
        if (!["booked", "full", "missing", "wrongnumber"].includes(bookingState[title])) {
            //console.log("Booking not done: " + title + " " + bookingState[title]);
            return false;
        }
    }
    return true;
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
}


async function refreshSport(sport, updateTitles=[]) {
    let doc;
    let stateColor = "white";
    if (courses[sport]) {
        let idx = courses[sport].lastIndexOf("/");
        let link = HSA_LINK + courses[sport].substr(idx+1);
        try {
            doc = await requestHTML("GET", "extern/" + link);
            updateStatus("Fetched HTML site for " + sport);
        } catch (err) {
            updateStatus("[ERROR] Course " + sport + " HTML request failed : " + JSON.stringify(err));
        }
    }

    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            let entryElem;
            let title = `${sport}_${nr}_${user}`;
            let BS_Code = "None";

            let alreadyBooked = bookingState[title] === "booked";

            // find number in loaded doc
            if (doc) {
                let nums = doc.getElementsByClassName("bs_sknr");
                for (let n of nums) {
                    if (n.innerHTML == nr) {
                        found = true;
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

                        // check booking button
                        let bookElem = n.parentElement.getElementsByClassName("bs_sbuch")[0];
                        let bookButton = bookElem.getElementsByClassName("bs_btn_buchen");
                        if (bookButton.length > 0) {
                            bookingState[title] = "ready";
                        } else {
                            bookButton = bookElem.getElementsByClassName("bs_btn_ausgebucht");
                            if (bookButton.length > 0) {
                                bookingState[title] = "full";
                            } else {
                                bookingState[title] = "none";
                                let bookTimeElems = bookElem.getElementsByClassName("bs_btn_autostart");
                                if (bookTimeElems.length > 0) {
                                    bookingTime[title] = bookTimeElems[0].innerHTML;
                                } else {
                                    delete bookingTime[title];
                                }
                            }
                        }
                        break;
                    }
                }
                if (!entryElem) {
                    entryElem = getErrorTable(nr, sport + ` (${user})`, "Wrong Number");
                    bookingState[title] = "wrongnumber";
                }
            } else {
                let errorMsg; 
                if(!courses[sport]) {
                    errorMsg = "Course missing"
                    bookingState[title] = "missing";
                } else {
                    errorMsg = "Page load failed";
                    bookingState[title] = "failed";
                }
                entryElem = getErrorTable(nr, sport + ` (${user})`, errorMsg)
            }

            // reset state to booked again if it was booked before
            if (alreadyBooked) {
                bookingState[title] = "booked";
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

        refreshSport(sport).then(() => {
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
                            updateEntryStateTitle(title, "Booked", "green");
                        }
                    } 
                }
            }
            xhr_booked.onerror = () => console.log("ERROR: Request to load bookedcourses.txt list failed");

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
                        courses[elem.innerHTML] = elem.href;
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
loadChoice().then(setTimeout( 
        () => loadCourses().then(refreshChoice).catch((error) => console.log("Initial loading failed: " + error.message)), 500));

// Load user data initially
const userDataInterval = setInterval( async () => {
    try {await loadUserData(); clearInterval(userDataInterval);} catch (e) {}
}, 2000);