const USERS_FILE = "userdata";
const CHOICE_FILE = "choice";
const BOOKED_FILE = "bookedcourses";

const timeout_msec = 6000;


var baseStorage; 
try {
  baseStorage = browser;
} catch { 
    baseStorage = chrome;
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
        baseStorage.storage.sync.get(filename).then((result) => {
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
        console.log(o);

        baseStorage.storage.sync.set(o)
        .then(() => resolve(o[filename]))
        .catch((err) => {
            console.log("[ERROR] : failed writing data " + filename);
            reject(err);
        });
    });
}

function addChangeListener(fun) {
    chrome.storage.onChanged.setListener(fun);
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