const HSA_LINK_new = "https://anmeldung.sport.uni-augsburg.de";
const HSA_LINK_old = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
var HSA_LINK = HSA_LINK_new;


const refreshInterval_short = 2000;
const refreshInterval_long = 5000;//30000;
const timeout_msec = 10000;

var choice = undefined;

// Dictionary from course name to link
var courses = {};
// Dictionary from title to state (ready, full, none, booked, missing, wrongnumber, failed (to load site))
var bookingState = {};
// Dictionary from title to HTML element containing the status of the title
var statusElements = {};

var ongoingXMLRequests = {};
var armID = 0;


function getColorForBookingState(bookingState) {
    let colors = {"booked" : "green", "ready" : "aqua", "full": "red", "missing": "maroon",
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

async function bookCourse(title) {
    console.log("bookCourse " + title + bookingState[title]);
    
    if (bookingState[title] == "booked") {
        updateEntryStateTitle(title, "Already booked", "green");
        return;
    } else if (bookingState[title] != "ready") {
        updateEntryStateTitle(title, "Booking failed: " + bookingState[title], "red");
        return;
    }

    console.log("Booking course " + title);
    updateEntryStateTitle(title, "Started booking", "blue");
    
    // find iframe for course
    let iFrameElem = document.getElementById("frame_"+title);
    iFrameElem.onload = 
    async function (event) { 

        let frameDoc = iFrameElem.contentDocument;
        console.log(title + " iFrame content:")
        console.log(frameDoc);
        
        let user = title.split("_")[2];


        // TODO fill form and submit 
        await sleep(3000);


        updateEntryStateTitle(title, "Booking successful", "green");
        bookingState[title] = "booked"; 

        // let server know that course was booked successful
        let xhr = new XMLHttpRequest();
        xhr.onerror = () => {
            console.log("WARNING: Failed to inform server about successful booking"); 
        };
        xhr.onloadend = () => {
            let bookedCourses = xhr.response;
            console.log("Successfully informed server about successfull booking.");
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
    formElem.submit(); // TODO requestSubmit()?

}

async function waitUntilReadyAndBook(sport, titles, checkAbortFun) {
    // find title that is valid
    console.log("Waiting until ready for " + sport +"\t" + titles);

    // TODO check time when booking is available for one title
    //let buchElem = statusElements[titles[0]].parentElement.getElementsByClassName("bs_sbuch")[0];

    // set refreshtime so it immediately updates in the first loop
    let lastRefreshTime = Date.now() - refreshInterval_short;
    while (titles.length > 0) {
        console.log(titles);
        console.log(JSON.stringify(bookingState));
        titles.forEach(function (t, index, array) {
            updateEntryStateTitle(t, bookingState[t], getColorForBookingState(bookingState[t]));
            if (["missing", "wrongnumber"].includes(bookingState[t])) {
                array.splice(index, 1);
            } else if (["ready", "full", "booked"].includes(bookingState[t])) {
                array.splice(index, 1)
                bookCourse(t);
            }
        })
        console.log(titles);
        if (checkAbortFun()) {
            throw new Error("aborted waitUntilReady(" + sport + ")");
        }

        if (Date.now() - lastRefreshTime >= refreshInterval_short) {
            lastRefreshTime = Date.now();
            let intervalID = setInterval(
                 () => {
                    for (let t of titles) {
                        updateEntryStateTitle(t, 
                           `Refresh (Timeout in ${Math.round((timeout_msec - (Date.now() - lastRefreshTime)) / 1000)})`, "#ffff00")
                    }
                },
                500);
            await refreshSport(sport);
            clearInterval(intervalID);
        } else {
            for (let t of titles) {
                updateEntryStateTitle(t, `Refreshing in ${Math.round((refreshInterval_short - (Date.now() -lastRefreshTime)) / 1000)}`, "#ffff00");
            }         
            // sleep for a  second
            await sleep(1000); 
        }
    }
    console.log("waitUntilReady for " + sport + " done");
}

async function arm() {
    updateStatus("Arming...", "append");

    if (courses.length == 0 || !choice) {
        updateStatus("Arming failed: List of courses and Choice not loaded", "replace");
        return;
    }

    let currentArmID = armID;
    checkAbortFun = () => {return armID != currentArmID;};

    const choiceElement = document.getElementById("choice");

    for (let sport of Object.keys(choice)) {
        let titles = [];
        for (let user of Object.keys(choice[sport])) {
            for (let nr of choice[sport][user]) {
                titles.push(`${sport}_${nr}_${user}`);
            }
        }

        waitUntilReadyAndBook(sport, titles, checkAbortFun)
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
    console.log("BS_Code of " + title + " is " + BS_Code);

    // update form target
    let formElem = entryElem.children[0];
    console.assert(formElem.tagName == "FORM");
    formElem.target = "frame_"+title;
}


async function refreshSport(sport) {
    let doc;
    let stateColor = "white";
    if (courses[sport]) {
        let idx = courses[sport].lastIndexOf("/");
        let link = HSA_LINK + "/angebote/aktueller_zeitraum" + courses[sport].substr(idx);
        try {
            doc = await requestHTML("GET", "extern/" + link);
        } catch (err) {
            updateStatus("Course " + sport + "HTML request failed : " + JSON.stringify(err));
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
                updateStatus("Refreshed choice course status.", "replace");
            }
        },
        500
    )

    for (let sport of Object.keys(choice)) {
        updateEntryStatesSport(sport, "Refreshing (Timeout in " + Math.round(timeout_msec/1000) + ")", "#ffff00");

        let startTime = Date.now();
        let intervalID = setInterval(
            () => updateEntryStatesSport(sport, `Refreshing (Timeout in
                 ${Math.round((timeout_msec - (Date.now() - startTime))/1000)})`, "#ffff00"), 
        1000);

        refreshSport(sport).then(() => {
            updatedSports.push(sport);
            clearInterval(intervalID);
            console.log("updating entries of " + sport);
            for (let user of Object.keys(choice[sport])) {
                for (let nr of choice[sport][user]) {
                    let title = `${sport}_${nr}_${user}`;
                    updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));
                }
            }
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
        xhr.onerror = () => {
            document.getElementById("choice").innerHTML = "failed ";
            reject();
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
                            `<iframe title="Anmeldung ${title}" name="frame_${title}" style="height:500px;width:300px;">
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
        xhr.open(
        "GET","choice.json",
        );
        xhr.responseType = "json";
        xhr.send();
    });
}


function loadCourses() {
    updateStatus("Loading courses...", "append");

    return requestHTML("GET",
            "extern/" + HSA_LINK + "/angebote/aktueller_zeitraum/"
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



document.getElementById("loadcourses").addEventListener("click", loadCourses);
document.getElementById("loadchoice").addEventListener("click", loadChoice);
document.getElementById("refreshchoice").addEventListener("click", refreshChoice);
document.getElementById("arm").addEventListener("click", arm);
document.getElementById("unarm").addEventListener("click", unarm);
document.getElementById("clearstatus").addEventListener("click", () => updateStatus("", "clear"));

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