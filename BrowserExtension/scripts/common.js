const USERS_FILE = "userdata";
const CHOICE_FILE = "choice";
const BOOKSTATE_FILE = "booked";
const ARMED_FILE = "armedcourses";

const armed_expiry_msec = 45000;
const booking_expiry_msec = 2500;
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
                let hrefs = [];
                for (let tab of tabs) {
                    hrefs.push(tab.url);
                }
                resolve(hrefs);
            });
    });
}

// closes every tab matching urlPattern except the active one / the first one if no tab is active
async function closeDuplicates(urlPattern) {
    return new Promise((resolve) => {
        base.tabs.query({ url: urlPattern},
            function (tabs) {
                console.log("OPEN TABS: ");
                console.log(tabs);
                let removeIDs = [];
                let isATabActive = false;
                for (let i = 1; i < tabs.length; i++) {
                    if (!isATabActive && tabs[i].isActive) {
                        removeIDs.push(tabs[0].id);
                        isATabActive = true;
                    } 
                    else
                        removeIDs.push(tabs[i].id);
                }
                base.tabs.remove(removeIDs, resolve);
            });
    });
}

async function createTabIfNotExists(tabUrl, switchToTab=true) {
    // remove anchors
    let tabUrlRaw = tabUrl.split("#")[0];
    base.tabs.query({ url: "*://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_*"},
        function (tabs) {
            for (let tab of tabs) {
                if (tab.url.split("#")[0] == tabUrlRaw) {
                    base.tabs.update(tab.id, {active: switchToTab, url: tabUrl});
                    return;
                }
            }
            // apparently no tab with that url open; open in new tab
            base.tabs.create({active: switchToTab, url: tabUrl});
        }
    );
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

function getFullDateStr(daymonth) {
        let [day, month] = daymonth.match(/\d+/g);
        day = day.length < 2 ? "0" + day : day;
        month = month.length < 2 ? "0" + month : month;
        let dateNow = new Date(Date.now());
        let monthNow = dateNow.getMonth() + 1; // months are being counted from 0
        let yearNow = dateNow.getUTCFullYear();
        // if start month is more than three months from now, it must mean that the course started last year
        date = day + "." + month + "." + String((month - monthNow > 3) ? yearNow-1 : yearNow); 
        return date;
}

function getCourseDateStr(tRowElem) {
    try {
        let daymonth = tRowElem.getElementsByClassName("bs_szr")[0].innerHTML.match(/\d+\.\d+\./)[0];
        return getFullDateStr(daymonth);
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
        let colorDef = (color == "none") ? "" : "background-color:"+color+";" 
        let idx = style.indexOf("background-color");
        // if background-color not in style, add it in front
        if (idx < 0) {
            style = colorDef + style;
        } else {
            let lastIdx = style.indexOf(";", idx);
            lastIdx = lastIdx >= 0 ? lastIdx : style.length-1; 
            style = style.substr(0, idx) + colorDef + style.substr(lastIdx+1);
        }
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
        d = d ?? {}; 
        //add expiry date
        let timeStamp = Date.now();
        for (let s of sports) {
            d[s] = timeStamp;
        }
        return upload(ARMED_FILE, d);
    });
}

function storeAsUnarmed(sport) {
    return download(ARMED_FILE)
    .then((d) => {
        if (d && d[sport]) {
            delete d[sport];
            return upload(ARMED_FILE, d);
        }
    })
}

function storeAsUnarmedAll() {
    return upload(ARMED_FILE, {});
}

async function isArmed(sport, armedData=null) {
    if (!armedData)
        armedData = await download(ARMED_FILE); 
    if (!armedData)
        return false;
    let stamp = armedData[sport];
    return (stamp && ((stamp + armed_expiry_msec) >= Date.now())) ? true : false;
}

// counts the armed courses and removes all expired ones from the list
async function getNumArmedCourses(armedData=null) {
    if (!armedData)
        armedData = await download(ARMED_FILE); 
    if (!armedData) 
        return 0;
    let counter = 0;
    let expired = [];
    let minNonExpired = Date.now() - armed_expiry_msec;
    for (let s of Object.keys(armedData)) {
        if (armedData[s] < minNonExpired) 
           expired.push(s); 
    }
    if (expired.length > 0) {
        expired.forEach((s) => delete armedData[s]);
        await upload(ARMED_FILE, armedData);
    }
    return Object.keys(armedData).length;
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

function getBookingStateFromData(bookStruct, user, id) {
    if (!bookStruct || !bookStruct[user] || !bookStruct[user][id]) {
        return null;
    }
    let [state, stamp] = bookStruct[user][id].split("_");
    stamp = parseInt(stamp);
    if (state == "booking")
        return ((stamp + booking_expiry_msec) >= Date.now()) ? state : null;
    else
        return state;
}

// check if state changed or if is just a timestamp update
function bookingDataChanged(newData, oldData, sport="") {
    //TODO
    return true;
}