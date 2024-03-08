var base; 
try {
  base = browser;
} catch { 
    base = chrome;
} 

const USERS_FILE = "userdata";
const CHOICE_FILE = "choice";
const BOOKSTATE_FILE = "booked-";
const BOOKSTATE_FILE_LOCAL = "booked-local-";
const ARMED_FILE = "armed_";
const OPTIONS_FILE = "options";
const COURSELINKS_FILE = "courselinks";
const REFRESH_FILE = "refresh";

function getStorage(filename) {
    switch (filename) {
        case USERS_FILE:
        case OPTIONS_FILE:
        case CHOICE_FILE:
        case BOOKSTATE_FILE:
            return base.storage.sync;
        //case BOOKSTATE_FILE_LOCAL:
        //case ARMED_FILE:
        default:
            return base.storage.local;
    }
}

const armed_expiry_msec = 45000;
const booking_expiry_msec = 1500;
const default_expiry_msec = 1000 * 60 * 60 * 24 * 30 * 8; // 8 months
const timeout_msec = 6000;


function hasExpired(timeStamp, expiry_msec) {
    return !timeStamp || (timeStamp + expiry_msec < Date.now()); 
}

function removeClass(a, b) { 
    let classes = a.className.split(" ");
    let newClasses = []
    for (let c of classes)
        if (!["", b].includes(c))
            newClasses.push(c);
    a.className = newClasses.join(" ");
}

function colorRow(tRowElem, state) {
    let classes = tRowElem.className.split(" ");
    // Remove all old trstate classes
    for (let i = classes.length-1; i >= 0; i--) {
        if (classes[i].startsWith("trstate-"))
            classes.splice(i, 1);
    }
    // Add fitting trstate class
    classes.splice(0, 0, "trstate-"+state);
    tRowElem.className = classes.join(" ");
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
function closeDuplicates(urlPattern) {
    return new Promise((resolve) => {
        base.tabs.query({ url: urlPattern},
            function (tabs) {
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

function createTabIfNotExists(tabUrl, switchToTab=true) {
    return new Promise((resolve) => {
        // remove anchors
        let tabUrlRaw = tabUrl.split("#")[0];
        base.tabs.query({ url: "*://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_*"},
            function (tabs) {
                for (let tab of tabs) {
                    if (tab.url.split("#")[0] == tabUrlRaw) {
                        base.tabs.update(tab.id, {active: switchToTab, url: tabUrl});
                        resolve(tab);
                        return;
                    }
                }
                // apparently no tab with that url open; open in new tab
                base.tabs.create({active: switchToTab, url: tabUrl})
                .then((tab) => resolve(tab));
            }
        );
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

async function downloadAll() {
    let localContent = await base.storage.local.get(null);
    return {...localContent, ...await base.storage.sync.get(null)};
}

function download(filename) {
    return new Promise(async function (resolve, reject) {
        getStorage(filename).get(filename)
        .then((result) => {
            //console.log(`Downloaded data ${filename}:`)
            //console.log(result[filename]);
            resolve(result[filename]);
        })
        .catch((err) => {
            console.error("[ERROR] : failed reading data " + filename + " from storage");
            reject(err);
        });
    });
}

function upload(filename, obj) {
    return new Promise(function (resolve, reject) {
        let o = {};
        o[filename] = obj;

        //console.log("Uploading data:")
        //console.log(o);

        getStorage(filename).set(o)
        .then(() => resolve(o[filename]))
        .catch((err) => {
            console.error("[ERROR] : failed writing data " + filename + " to storage");
            reject(err);
        });
    });
}

function remove(filename) {
    return getStorage(filename).remove(filename);
}

function addStorageListener(fun) {
    base.storage.sync.onChanged.addListener(fun);
    base.storage.local.onChanged.addListener(fun);
}
function removeStorageListener(fun) {
    base.storage.sync.onChanged.removeListener(fun);
    base.storage.local.onChanged.removeListener(fun);
}


// Getters and setters for options

var option_var;

async function getOption(val, allowcache=true) {
    // Override default values for some options
   if (val == "multipleusers")
        return 0;
    if (val == "defaultuseridx")
        return 1;
    if (val == "bypasscountdown")
        return 0;

    if (!option_var || !allowcache) {
        option_var = await download(OPTIONS_FILE);
    }
    if (option_var && option_var[val] != undefined)
        return option_var[val];
    else {
        // return default values
        if (val == "fillform")
            return 1;
        if (val == "multipleusers")
            return 0;
        if (val == "defaultuseridx")
            return 1;
        if (val == "bypasscountdown")
            return 0;
        return null;
    }
}

async function setOption(option, value) {
    if (!option_var) {
        option_var = await download(OPTIONS_FILE) ?? {};
    }
    option_var[option] = value;
    return upload(OPTIONS_FILE, option_var);
}

async function setAllOptions(options) {
    if (!option_var) {
        option_var = await download(OPTIONS_FILE) ?? {};
    }
    for(let o of Object.keys(options))
        option_var[o] = options[o];
    return upload(OPTIONS_FILE, option_var);
}


function dateFromDDMMYY(s) {
    let nrs = s.match(/\d+/g);
    return new Date(nrs[2], nrs[1]-1, nrs[0])
}

function getCourseNr(tRowElem) {
    return tRowElem.getElementsByClassName("bs_sknr")[0].innerText;
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
        let daymonth = tRowElem.getElementsByClassName("bs_szr")[0].innerText.match(/\d+\.\d+\./)[0];
        return getFullDateStr(daymonth);
    } catch (err) {
        throw err;
    }
}

function getCourseDate(tRowElem) {
    return dateFromDDMMYY(getCourseDateStr(tRowElem));
}


function storeAsArmed(sport) {
    return storeAsArmedCourses([sport]);
}

async function storeAsArmedCourses(sports) {
    let timeStamp = Date.now();
    for (let sport of sports) {
        let file = ARMED_FILE + sport;
        await upload(file, timeStamp);  
    }
}

function storeAsUnarmed(sport) {
    return storeAsUnarmedCourses([sport]);
}

async function storeAsUnarmedCourses(sports) {
    for (let sport of sports) {
        let file = ARMED_FILE + sport;
        await remove(file);  
    }
}

async function isArmed(sport) {
    let stamp = await download(ARMED_FILE+sport);
    return !hasExpired(stamp, armed_expiry_msec);
}

function removeIdFromChoice(choice, sport, user, id) {
    let success = false;
    if (choice[sport] && choice[sport][user]) {
        for (let i = choice[sport][user].length-1; i >= 0; i--) {
            if (choice[sport][user][i] == id) {
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

async function getBookingState(courseID, includeTimestamp=false, localOnly=false, syncOnly=false) {
    // check sync bookstate first
    let bookState;
    if (!localOnly) {
        bookState = await download(BOOKSTATE_FILE+courseID);
    }
    if (!bookState && !syncOnly)
        bookState = await download(BOOKSTATE_FILE_LOCAL+courseID);
    if (includeTimestamp || !bookState)
        return bookState;
    let [state, stamp] = bookState;
    stamp = parseInt(stamp);
    if (state == "booking")
        return !hasExpired(stamp, booking_expiry_msec) ? state : null;
    else
        return state;
}

async function setBookingState(courseID, state, local) {
    let timestamp = Date.now();
    await upload( (local ? BOOKSTATE_FILE_LOCAL : BOOKSTATE_FILE)+courseID,
         [state, timestamp]);
    return timestamp;
}

async function removeBookingState(courseID, local=false) {
    if (local)
        await remove(BOOKSTATE_FILE_LOCAL+courseID);
    else
        await remove(BOOKSTATE_FILE+courseID);
}