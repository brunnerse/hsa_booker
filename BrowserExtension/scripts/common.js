const USERS_FILE = "userdata";
const CHOICE_FILE = "choice";
const BOOKSTATE_FILE = "booked";
const ARMED_FILE = "armedcourses";

const timeout_msec = 6000;


var base; 
try {
  base = browser;
} catch { 
    base = chrome;
} 

function removeClass(a, b) { 
    let classes = a.className.split(" ");
    let newClasses = []
    for (let c of classes)
        if (!["", b].includes(c))
            newClasses.push(c);
    a.className = newClasses.join(" ");
}

function sleep(msec) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, msec);
    });
}

function requestHTML(method, url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        // abort any ongoing request to the same url

        xhr.open(method, url);
        xhr.responseType = "document";
        xhr.timeout = timeout_msec;
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
            delete ongoingXMLRequests[url];
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.ontimeout = function () {
            reject({
                status: this.status,
                statusText: "timeout " + xhr.statusText
            });
        };
        xhr.send();
    });
}

function getCurrentTabHref() {
    return new Promise((resolve) => {
        base.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            // since only one tab should be active and in the current window at once
            // the return variable should only have one entry
            var activeTab = tabs[0];
            resolve(activeTab.url);
        });
    });
}

function getAllTabsHref() {
    return new Promise((resolve) => {
        base.tabs.query({ url: "*://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_*"},
        function (tabs) {
            console.log("ALL OPEN TABS:")
            console.log(tabs);
            let hrefs = [];
            for (let tab of tabs) {
                hrefs.push(tab.url);
            }
            resolve(hrefs);
        });
    });
}

function getJSONFileString(obj) {
    const tab="    ";
    let jstr = JSON.stringify(obj);
    let str = "";
    let level = 0;
    let bracketCtr = 0;
    for (let c of jstr) {
        switch (c) {
            case "{":
                level++;
                str += c + "\n" + tab.repeat(level);
                break;
            case "}":
                level--;
                str += "\n" + tab.repeat(level) + c;
                break;
            case "[":
                bracketCtr++;
                str += c;
                break;
            case "]":
                bracketCtr--;
                str += c;
                break;
            case ",":
                if (bracketCtr == 0)
                   str += c + "\n" + tab.repeat(level);
                else
                    str += c + " ";
                break;
            case ":":
                str += " " + c + tab + tab;
                break;
            default:
                str += c;
        }
    }
    return str;
}


function download(filename) {
    return new Promise(async function (resolve, reject) {
        base.storage.sync.get(filename).then((result) => {
            resolve(result[filename]);
        })
        .catch((err) => {
            console.log("[ERROR] : failed reading data " + filename);
            reject(err);
        });
    });
}

function upload(filename, obj) {
    return new Promise(async function (resolve, reject) {
        let o = {};
        o[filename] = obj;

        console.log("Uploading data:")
        console.log(o);

        base.storage.sync.set(o)
        .then(() => resolve(o[filename]))
        .catch((err) => {
            console.log("[ERROR] : failed writing data " + filename);
            reject(err);
        });
    });
}

function addStorageListener(fun) {
    base.storage.sync.onChanged.addListener(fun);
}
function removeStorageListener(fun) {
    base.storage.sync.onChanged.removeListener(fun);
}


// Getters and setters for options

var option_var;

async function getOption(val) {
    if (!option_var) {
        option_var = await download("options");
    }
    if (option_var && option_var[val])
        return option_var[val];
    else {
        // return default values
        if (val == "multipleusers")
            return 0;
        else if (val == "mode")
            return "formonly";
        else if (val == "defaultuseridx")
            return 1;
        else if (val == "bypasscountdown")
            return 0;
        else
            return null;
    }
}

async function setOption(option, value) {
    if (!option_var) {
        option_var = await download("options") ?? {};
    }
    option_var[option] = value;
    return upload("options", option_var);
}

async function setAllOptions(options) {
    if (!option_var) {
        option_var = await download("options") ?? {};
    }
    for(let o of Object.keys(options))
        option_var[o] = options[o];
    return upload("options", option_var);
}


function dateFromDDMMYY(s) {
    let nrs = s.match(/\d+/g);
    console.log(nrs)
    return new Date(nrs[2], nrs[1]-1, nrs[0])
}

function getCourseNr(tRowElem) {
    return tRowElem.getElementsByClassName("bs_sknr")[0].innerHTML;
}
function getCourseDateStr(tRowElem) {
    try {
        let dateNow = new Date(Date.now());
        let monthNow = dateNow.getMonth();
        let yearNow = dateNow.getUTCFullYear();

        let date = tRowElem.getElementsByClassName("bs_szr")[0].innerHTML.match(/\d+\.\d+\./)[0];
        let month = date.match(/\d+/g)[1];
        // if start month is more than three months from now, it must mean that the course started last year
        date += "." +  (month - monthNow > 3) ? yearNow : yearNow - 1; 
        return date;
    } catch (err) {
        throw err; // TODO make silent?
    }
}

function getCourseDate(tRowElem) {
    return dateFromDDMMYY(getCourseDateStr(tRowElem));
}

function colorRow(tRowElem, color) {
    // Color the entire line light green
    for (let c of tRowElem.children) {
        let style = c.getAttribute("style") ?? "";
        let idx = style.indexOf("background-color");
        idx = (idx >= 0) ? idx : style.length-1; 
        let lastIdx = style.indexOf(";", idx);
        lastIdx = (lastIdx >= 0) ? lastIdx : style.length;
        style = style.substr(0, idx) + 
            (color == "none" ? "" : "background-color:"+color) +
            style.substr(lastIdx);
        c.setAttribute("style", style);
    }
}


function storeAsArmed(sport) {
    return storeAsArmedCourses([sport]);
}
// TODO expiry date
// TODO throw error if already armed by different tab? 
function storeAsArmedCourses(sports) {
    // mark website as armed in options
    return download(ARMED_FILE)
    .then((d) => {
        d = d ?? []; //TODO add expiry date
        for (let s of sports) {
            if (!d.includes(s))
                d.push(s);
        }
        return upload(ARMED_FILE, d);
    });
}

function storeAsUnarmed(sport) {
    return download(ARMED_FILE)
    .then((d) => {
        if (d) {
            let idx = d.indexOf(sport);
            if (idx >= 0) 
                d.splice(idx,1);
            return upload(ARMED_FILE, d);
        }
    })
}

function isArmed(sport) {
    return download(ARMED_FILE)
    .then((d) => {
        d = d ?? []; //TODO add expiry date; remove sport if expiry date is done
        return d.includes(sport)
    });
}

function removeNrFromChoice(choice, sport, user, nr) {
    let success = false;
    if (choice[sport] && choice[sport][user]) {
        for (let i = choice[sport][user].length-1; i >= 0; i--) {
            if (choice[sport][user][i].split("_")[0] == nr) {
                choice[sport][user].splice(i, 1);
                success = true;
            }
        }
        // clean up choice obj
        if (choice[sport][user].length == 0) {
            delete choice[sport][user];
            if (Object.keys(choice[sport]).length == 0)
                delete choice[sport];
        }
    }
    return success;
}