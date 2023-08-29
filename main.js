//const HSA_LINK = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
//const HSA_LINK = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
const HSA_LINK = "https://anmeldung.sport.uni-augsburg.de"

const refreshInterval_short = 2;
const refreshInterval_long = 5;//30;
const timeout_sec = 30;

var choice = undefined;

var bookingState = {};
var courses = {};
var statusElements = {};

var armID = 0;


// TODO timeout
function requestHTML(method, url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.responseType = "document";
        xhr.onloadend = function () {
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
            reject({
                status: this.status,
                statusText: xhr.statusText
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
    let user = title.split("_")[2];
    console.log("Booking course" + title);

    if (bookingState[title] != "ready") {
        updateEntryStateTitle(title, "Booking failed: " + bookingState[title], "red");
        throw "failed";
    }
    updateEntryStateTitle(title, "Started booking", "blue");

    // find form element for course
    let formElem = statusElements[title].parentElement;
    while (formElement.tagName != "FORM") 
        formElem = formElem.parentElement;
    let elem = statusElements[title].parent

    form.submit();

    //updateEntryStateTitle(title, "Booking successful", "green");
    
}

async function waitUntilReady(sport, titles, checkAbortFun) {
    // find title that is valid
    let title;
    for (let t of titles) {
        if (bookingState[t] != "missing" && bookingState[t] != "wrongnumber") {
            title = t;
            break;
        }
    }
    if (!title) {
        throw "All bookings for " + sport + "are invalid";
    }
    return;
    //let buchElem = statusElements[title].parentElement.getElementsByClassName("bs_sbuch")[0];
    let lastRefreshTime = 0;
    while (!checkAbortFun()) {
        if (["ready", "full"].includes(bookingState[title]) ) {
            updateEntryStatesSport(sport, "Ready for booking", "blue");
            return "";
        }
        if (Date.now() - lastRefreshTime < refreshInterval_short) {
            lastRefreshTime = Date.now();
            let intervalID = setInterval(
                () => updateEntryStatesSport(sport, 
                    `Refreshing (Timeout in ${Math.round(timeout_sec - (Date.now() - lastRefreshTime) / 1000)})`, "#ffff00"),
                1000);
            await refreshSport(sport);
            // TODO inform if refrehSport failed
            clearInterval(intervalID);
            for (let t of titles) {
                    updateEntryStateTitle(t, bookingState[t]);
            }         
            return;
        } else {
            updateEntryStatesSport(sport, `Refreshing in ${((refreshInterval_short - (Date.now() -lastRefreshTime)) / 1000)}`);
            // sleep for a  second
            await new Response((resolve, reject) => setTimeout(resolve, 1000));

        }
        
    }
}

async function arm() {
    console.log("Arming...");
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
                titles.push('${sport}_${nr}_${user}');
            }
        }

        waitUntilReady(sport, titles, checkAbortFun)
        .then((response) => {
            for (let t of titles)
                bookCourse(t);
        },
        (error) => {

        });
    }
    updateStatus("Armed.", "replace");

}

async function unarm() {
    armID += 1;
    updateStatus("Unarmed.", "append");
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
            entryElem = tableEntry.children[0];
            break;
        }
    }
    if (!found) {
        let choiceElem = document.getElementById("choice");
        choiceElem.innerHTML += availElem.innerHTML;
        entryElem = choiceElem.children[choiceElem.children.length-1];
    }
    entryElem.setAttribute("title", title);

    // append status bar to table row
    const rowElem = entryElem.getElementsByTagName("TR")[1];
    const statusElem = entryElem.getElementsByClassName("nr_name")[0];
    rowElem.innerHTML = entryHTML + statusElem.outerHTML;

    statusElements[title] = rowElem.getElementsByClassName("nr_name")[0];

    // update BS_Code
    let inputTableBS = entryElem.getElementsByTagName("INPUT")[0];
    console.assert(inputTableBS.name == "BS_Code");
    inputTableBS.value = BS_Code;
}


async function refreshSport(sport) {
    let doc;
    if (!courses[sport]) {
        console.log("[%s] Not available ", sport);
    } else {
        let idx = courses[sport].lastIndexOf("/");
        let link = HSA_LINK + "/angebote/aktueller_zeitraum" + courses[sport].substr(idx);
        console.log("[%s] Available -> %s", sport, link);
        try {
            doc = await requestHTML("GET", "extern?url=" + link);
        } catch (e) {
            updateStatus("Course " + sport + "HTML request failed");
        }
    }

    for (let user of Object.keys(choice[sport])) {
        for (let nr of choice[sport][user]) {
            let entryElem;
            let title = `${sport}_${nr}_${user}`;
            let BS_Code = "None";

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
                                bookingState[title] = "none"
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

            updateEntryInTable(entryElem, sport, nr, user, BS_Code);
            updateEntryState(sport, nr, user, bookingState[title]);
        }
    }
}

async function refreshChoice() {
    updateStatus("Refreshing choice course status...");

    if (!choice) {
        loadChoice();
        return;
    }

    for (let sport of Object.keys(choice)) {
        //updateStatus(`Refreshing course ${sport}...`, "append");
        let intervalID = setInterval(
            () => updateEntryStatesSport(sport, `Refreshing (Timeout in
                 ${Math.round(timeout_sec - (Date.now() - startTime)/1000)})`, "#ffff00"), 
        1000);
        let startTime = Date.now();
        updateEntryStatesSport(sport, "Refreshing...", "#ffff00");
        refreshSport(sport).then(() => {
            clearInterval(intervalID);
            for (let user of Object.keys(choice[sport])) {
                for (let nr of choice[sport][user]) {
                    let title = `${sport}_${nr}_${user}`;
                    updateEntryStateTitle(title, bookingState[title]);
                }
            }
        });
    }
    //console.log(bookingState);
    //updateStatus("Refresh of courses complete.", "replace");
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
            document.getElementById("courses").innerHTML = "failed ";
            reject();
        };
        xhr.onloadend = () => {
            choice = xhr.response;
            console.log("Loaded choice.")
            console.log(choice);

            // Remove tables and create table entry for each choice
            document.getElementById("choice").innerHTML = "";
            for (let sport of Object.keys(choice)) {
                for (let user of Object.keys(choice[sport])) {
                    for (let nr of choice[sport][user]) {
                        entryElem = getErrorTable(nr, sport + ` (${user})`, "init");
                        updateEntryInTable(entryElem, sport, nr, user, "");
                    }
                }
            }
            updateStatus("Loaded choice.", "replace");
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

    return new Promise(function (resolve, reject) {
        requestHTML("GET",
            "extern?url=" + HSA_LINK + "/angebote/aktueller_zeitraum/"
        ).then (  
            (doc) => {
                let rootElems = doc.getElementsByClassName("bs_menu");
                for (let rootElem of rootElems) {
                    for (let elem of rootElem.getElementsByTagName("A")) {
                        console.log(`${elem.innerHTML} -> ${elem.href}`);
                        courses[elem.innerHTML] = elem.href;
                    }
                }
                document.getElementById("courses").innerHTML = 
                    "<div class=\"col-xs-12 content noPadRight\">"+
                    doc.getElementsByClassName("item-page")[0].innerHTML
                    +"</div>" ;

                console.log("Available courses: " + Object.keys(courses));

                updateStatus("Loaded courses.", "replace");
                resolve();
            },
            (err) => {
                //  document.getElementById("courses").innerHTML = "failed ";
                updateStatus("Loading courses failed.", "append");
                reject();
            }
        );
    });


}




document.getElementById("loadcourses").addEventListener("click", loadCourses);
document.getElementById("loadchoice").addEventListener("click", loadChoice);
document.getElementById("refreshchoice").addEventListener("click", refreshChoice);
document.getElementById("arm").addEventListener("click", arm);
document.getElementById("unarm").addEventListener("click", unarm);
document.getElementById("clearstatus").addEventListener("click", () => updateStatus("", "clear"));

// Load courses automatically on refresh
// load choice no matter if loadCourses is succesful or fails
loadCourses().then(loadChoice, loadChoice).then(refreshChoice);