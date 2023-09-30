const USERS_FILE = "userdata.json"
const CHOICE_FILE = "choice.json"

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


function download(filename, type="json") {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed loading file " + filename);
            reject(err);
        };
        xhr.onloadend = async () => {
            //TODO remove
            await sleep(500);
            if (xhr.status == "404") 
                reject(new Error("Got code 404 not found"));
            else
                resolve(xhr.response);
        }
        xhr.open("GET", filename); 
        xhr.responseType = type;
        xhr.send();
    });
}

function upload(filename, obj, type="json") {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed writing to file!");
            reject(err);
        };
        xhr.onloadend = async () => {
            //TODO remove
            await sleep(500);
            if (xhr.status == "404")
                reject(new Error("404: FILE " + FILE + " not found on server"));
            else
                resolve(xhr.response);
        }
        xhr.open("POST", filename + "?write");
        xhr.responseType = type;
        let toSend = (type == "json") ?  getJSONFileString(obj) : obj;
        xhr.send(toSend);
    });
}