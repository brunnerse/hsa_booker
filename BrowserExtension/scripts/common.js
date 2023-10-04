const USERS_FILE = "userdata";
const CHOICE_FILE = "choice";
const BOOKED_FILE = "bookedcourses";

function sleep(msec) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, msec);
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
        //TODO remove
        await sleep(500);

        chrome.storage.sync.get(filename).then((result) => {
            resolve(result[filename]);
        })
        .catch((err) => {
            console.log("[ERROR] : failed reading file " + filename);
            reject(err);
        });
    });
}

function upload(filename, obj) {
    return new Promise(async function (resolve, reject) {
        //TODO remove
        await sleep(500);
        let o = {};
        o[filename] = obj;
        console.log(o);

        chrome.storage.sync.set(o).then(() => resolve(o[filename]))
        .catch((err) => {
            console.log("[ERROR] : failed reading file " + filename);
            reject(err);
        });
    });
}