const HSA_LINK = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
//const HSA_LINK = "https://anmeldung.sport.uni-augsburg.de"

var choice = undefined;

var states = {};
var courses = {};


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


async function arm() {
    console.log("Arming...");
    updateStatus("Arming...", "append");

    if (courses.length == 0 || !choice) {
        updateStatus("Arming failed: List of courses and Choice not loaded", "replace");
        return;
    }

    setTimeout(() => updateStatus("Armed.", "replace"), 1000);
}

function updateEntryInTable(entryHTML, nr, BS_Code) {
    const tableElem = document.getElementById("avail");
    tableElem.getElementsByTagName("TR")[1].innerHTML = entryHTML;
    tableElem.children[0].setAttribute("title", nr);

    // update BS_Code
    let inputTableBS = tableElem.getElementsByTagName("INPUT")[0];
    console.assert(inputTableBS.name == "BS_Code");
    inputTableBS.value = BS_Code;

    // check if nr is already in table
    let found = false;
    for (let tableEntry of document.getElementById("choice").children) {
        if (tableEntry.getAttribute("title") == nr) {
            found = true;
            tableEntry.innerHTML = tableElem.children[0].innerHTML;
            break;
        }
    }
    if (!found) {
        document.getElementById("choice").innerHTML += tableElem.innerHTML;
    }
}

async function refreshSport(c) {
    if (!courses[c]) {
        let firstUser = Object.keys(choice[c])[0];
        let firstNr = choice[c][firstUser][0]
        updateEntryInTable(getErrorTable(firstNr, c, "Not available"), firstNr, "xx");
        console.log("[%s] Not available ", c);

        for (let user of Object.keys(choice[c])) {
            for (let nr of choice[c][user]) {
                states[nr] = "unavailable";
            }
        }
    } else {
        let idx = courses[c].lastIndexOf("/");
        let link = HSA_LINK + "/angebote/aktueller_zeitraum" + courses[c].substr(idx);
        console.log("[%s] Available -> %s", c, link);

        let doc = await requestHTML("GET", "extern?url=" + link);
        let nums = doc.getElementsByClassName("bs_sknr");
        for (let user of Object.keys(choice[c])) {
            for (let nr of choice[c][user]) {
                let found = false;
                for (let n of nums) {
                    if (n.innerHTML == nr) {
                        found = true;
                        let detailStr = n.parentElement.getElementsByClassName("bs_sdet")[0].innerHTML;
                        let idx = detailStr.indexOf('-');
                        idx = idx >= 0 ? idx : detailStr.length;
                        detailStr = detailStr.substr(0, idx);
                        n.parentElement.getElementsByClassName("bs_sdet")[0].innerHTML = detailStr + ` - ${c} (${user})`;

                        // get BS_Code
                        let formElem = n.parentElement;
                        while (formElem.tagName != "FORM")
                            formElem = formElem.parentElement;
                        let inputBS = formElem.getElementsByTagName("INPUT")[0];
                        console.assert(inputBS.name == "BS_Code");

                        updateEntryInTable(n.parentElement.innerHTML, nr, inputBS.value);

                        // check booking button
                        let bookElem = n.parentElement.getElementsByClassName("bs_sbuch")[0];
                        let bookButton = bookElem.getElementsByClassName("bs_btn_buchen");
                        if (bookButton.length > 0) {
                            states[nr] = "ready";
                        }
                        else {
                            bookButton = bookElem.getElementsByClassName("bs_btn_ausgebucht");
                            if (bookButton.length > 0) {
                                states[nr] = "full";
                            } else {
                                states[nr] = "button_gone"
                            }
                        }
                        break;
                    }
                }
                if (!found) {
                    updateEntryInTable(getErrorTable(nr, c, "Wrong Number"), nr, "xy");
                    states[nr] = "wrongnumber";
                }
            }
        }
    }
}

async function refreshChoice() {
    updateStatus("Refreshing choice course status...");

    if (!choice) {
        loadChoice();
        return;
    }

    for (let c of Object.keys(choice)) {
        updateStatus(`Refreshing course ${c}...`, "replace");
        let success = await refreshSport(c);
    }
    console.log(states);
    updateStatus("Refresh of courses complete.", "replace");
}



function loadChoice() {
    updateStatus("Loading choice...", "append");

    if (courses.length == 0) {
        updateStatus("Loading choice failed: List of courses not loaded", "replace");
        return;
    }

    let xhr = new XMLHttpRequest();
    xhr.onerror = () => {
        document.getElementById("courses").innerHTML = "failed ";
    };
    xhr.onloadend = () => {
        choice = xhr.response;
        console.log("Loaded choice.")
        console.log(choice);
        updateStatus("Loaded choice.", "replace");

        refreshChoice();
    }

    xhr.open(
    "GET","choice.json",
    );
    xhr.responseType = "json";
    xhr.send();

}

function loadCourses() {
    updateStatus("Loading courses...", "append");

    return requestHTML("GET",
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
        }
    ).catch (
        (err) => {
            document.getElementById("courses").innerHTML = "failed ";
        }
    );

}




document.getElementById("loadcourses").addEventListener("click", ()=>loadCourses());
document.getElementById("loadchoice").addEventListener("click", ()=>loadChoice());
document.getElementById("refreshchoice").addEventListener("click", ()=>refreshChoice());
document.getElementById("arm").addEventListener("click", () => arm());

loadCourses().then(loadChoice)