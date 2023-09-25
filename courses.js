const FILE = "choice.json";
let userdata;

const statusElem = document.getElementById("statustext");
const iFrame = document.getElementById("iframe");


function downloadChoice() {
    setStatus("Fetching course choice...");
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed loading course choice");
            setStatus("Failed to load course choice", "red");
            reject(err);
        };
        xhr.onloadend = async () => {
            if (xhr.status == "404")
                throw new Error("404: choice.json not found on server");
            userdata = xhr.response;
            // TODO remove sleep
            await sleep(1000);
            setStatus("Fetched course choice.")
            resolve(userdata);
        }
        xhr.open("GET", FILE); 
        xhr.responseType = "json";
        xhr.send();
    });
}

function uploadChoice() {
    setStatus("Updating user data...");
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.onerror = (err) => {
            console.log("[ERROR] : failed writing to file!");
            setStatus("Failed to update user data", "red");
            reject(err);
        };
        xhr.onloadend = async () => {
            if (xhr.status == "404")
                throw new Error("404: FILE " + FILE + " not found on server");
            // update userdata with response
            userdata = xhr.response;
            await updateUserSelect();
            setStatus("Successfully updated user data.");
            resolve();
        }
        xhr.open("POST", FILE + "?write");
        xhr.responseType = "json";
        xhr.send(getJSONFileString(userdata));
    });
}


async function addCourse(user) {
    // get data from form
    let data = {};

    // Get status select option
    let selectElem = formElem.getElementsByTagName("SELECT")[0];
    console.assert(formElem.getElementsByTagName("SELECT").length == 1);
    data.statusorig = selectElem.options[selectElem.selectedIndex].value;

    let inputElems = formElem.getElementsByTagName("INPUT");
    for (let inputElem of inputElems) {
        // Get sex radio button
        if (inputElem["name"] == "sex") {
            if (inputElem.checked)
                data.sex = inputElem.value; 
        } else {
            if (inputElem.getAttribute("disabled") != "disabled" && inputElem["name"] != "bic")
                // get form data
                data[inputElem["name"]] = inputElem.value;
        }
    }

    return downloadUserData().then(() => {
        userdata[user] = data;
    }).then(uploadUserData)
      .then(() => setStatus("Added user " + user + ".", "green"));
}

function setStatus(status, color="white") {
    let style = "font-weight:bold;background-color: " + color + ";"
    statusElem.setAttribute("style", style);
    statusElem.innerHTML = status;
}

function toggleInert() {
    console.log("toggling inert...");
//    document.getElementById("btn_cancel").toggleAttribute("inert");
}


iFrame.onload =  
() => {
    let url = iFrame.contentWindow.location.href;
    console.log("Loaded new frame: " + url);
    // replace all external links with localhost extern links
    aElems = iFrame.contentDocument.getElementsByTagName("A");
    for (let a of aElems) {
        let href = a.getAttribute("href");
        if (href && href.startsWith("http")) {
            a.href = "/extern/"+href;
        } 
    }

    // TODO check if URL is a course (or check contentDocument for that)
    if (false) {

        setStatus("Choose course to add", "white")
    } else {
        setStatus("Current Page is not a Course page", "white")
        // TODO modify page
    }
//       addUser(selectedUser).then(() => setSelectedUser(selectedUser)).finally(toggleInert);
};
