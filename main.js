const HSA_LINK = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
//const HSA_LINK = "https://anmeldung.sport.uni-augsburg.de"

var choice = undefined;

var states = {};


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


function getErrorTable(nr, details, error) {
    const notAvailElem = document.getElementById("notavail");
    const notAvailNr = notAvailElem.getElementsByTagName("TBODY")[0].getElementsByClassName("bs_sknr")[0];
    const notAvailName = notAvailElem.getElementsByTagName("TBODY")[0].getElementsByClassName("bs_sdet")[0];
    const notAvailMsg = notAvailElem.getElementsByTagName("TBODY")[0].getElementsByClassName("bs_btn_ausgebucht")[0];
    notAvailNr.innerHTML = nr;
    notAvailName.innerHTML = details;
    notAvailMsg.innerHTML = error;
    return notAvailElem.innerHTML;
}


async function arm() {
    console.log("Arming...");
    updateStatus("Arming...", "append");
    setTimeout(()=>updateStatus("Armed.", "replace"), 2000);
}


async function refreshChoice() {
    updateStatus("Refreshing choice course status...");
    console.log("Choice: " + choice);
    if (!choice) {
        loadChoice();
        return;
    }

    let courses = {}
    rootElem = document.getElementById("courses");
    for (elem of rootElem.getElementsByTagName("A")) {
        courses[elem.innerHTML] = elem.href;
    }
    console.log("Available courses: " + Object.keys(courses));


    const tableElem = document.getElementById("avail");
    let text = ""; //"<div class=\"col-xs-12 content noPadRight\">";

    for (let c of Object.keys(choice)) {
        updateStatus(`Refreshing course ${c}...`, "replace");
        if (!courses[c]) {
            text += getErrorTable(nr, c, "Unavailable");
            console.log("[%s] Not available ", c);
            for (let user of Object.keys(choice[c])) {
                for (let nr of choice[c][user]) {
                    states[nr] = "unavailable";
                }
            }
        } else {
            console.log("[%s] Available ", c);
            let idx = courses[c].lastIndexOf("/");
            let link = HSA_LINK + "/angebote/aktueller_zeitraum" + 
                courses[c].substr(idx);
            console.log(link);
            let doc = await requestHTML("GET","extern?url="+link);
            let nums = doc.getElementsByClassName("bs_sknr");
            for (user of Object.keys(choice[c])) {
                for (nr of choice[c][user]) {
                    let found = false;
                    for (n of nums) {
                        if (n.innerHTML == nr) {
                            found = true;
                            tableElem.getElementsByTagName("TR")[1].innerHTML = n.parentElement.innerHTML;
                            text += tableElem.innerHTML;
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
                        text += getErrorTable(nr, c, "Wrong Number");
                        states[nr] = "wrongnumber";
                    }
                }
            }
        }
        
    }

    //text += "</div>";
    document.getElementById("choice").innerHTML = text;
    console.log(states);
    updateStatus("Refresh of courses complete.", "replace");
}

function loadChoice() {
    updateStatus("Loading choice...", "append");
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

    const xhr = new XMLHttpRequest();
    xhr.onerror = () => {
            document.getElementById("courses").innerHTML = "failed ";
        };
    xhr.onload = () => {
        console.log("Loaded [Status %d]", xhr.status);
    };
    xhr.onloadend = () => {
        console.log("Load end.");
        doc = xhr.responseXML;  
    
        courses = []
        rootElems = doc.getElementsByClassName("bs_menu");
        for (rootElem of rootElems) {
            for (elem of rootElem.getElementsByTagName("A")) {
                console.log(elem.innerHTML)
                console.log("[Link] " + elem.href)
                courses.push(elem.innerHTML);
            }
        }
         console.log("Courses: " + courses);
         document.getElementById("courses").innerHTML = 
         //"<textarea>"+courses+"</textarea>"
         "<div class=\"col-xs-12 content noPadRight\">"+
         doc.getElementsByClassName("item-page")[0].innerHTML
         +"</div>"
         ;
        updateStatus("Loaded courses.", "replace");
    }

    xhr.open(
      "GET",
      "extern?url="+HSA_LINK+"/angebote/aktueller_zeitraum/",
    );
    xhr.responseType="document"
    xhr.send();

}




document.getElementById("loadcourses").addEventListener("click", ()=>loadCourses());
document.getElementById("loadchoice").addEventListener("click", ()=>loadChoice());
document.getElementById("refreshchoice").addEventListener("click", ()=>refreshChoice());
document.getElementById("arm").addEventListener("click", () => arm());

loadCourses();