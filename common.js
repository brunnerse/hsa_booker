
function sleep(msec) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, msec);
    })
}


function getJSONFileString(obj) {
    const tab="    ";
    let jstr = JSON.stringify(obj);
    let str = "";
    let level = 0;
    for (let c of jstr) {
        switch (c) {
            case "{":
                level++;
                str += c + "\n" + tab.repeat(level);
                break;
            case "}":
                level--;
                str += "\n" + tab.repeat(level) + c + tab.repeat(level);
                break;
            case ",":
                str += c + "\n" + tab.repeat(level);
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