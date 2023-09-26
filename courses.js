const FILE = "choice.json";

let userdata;
let courses = {};

const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
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

async function onSelectChange(userSelectElem) {
    let selectedUser = getSelectedUser(userSelectElem);
    if (selectedUser == "") {
        if (userSelectElem.options[userSelectElem.selectedIndex].title == "adder") {
            // open user edit page in new tab
            window.open("/Users.html", '_blank').focus();
            // reset selection to the first blank one
            setSelectedUser(userSelectElem, "");
        }
        return;
    }
}

async function onAdd(button) {
    console.log("Add:");
    console.log(button);
    let user = getSelectedUser(userSelectElem);
    if (!user) {
        alert("Select a user to add the course for in the top left corner first.")
        return;
    }
    //TODO

//       addUser(selectedUser).then(() => setSelectedUser(selectedUser)).finally(toggleInert);
}

iFrame.onload =  
() => {
    let url = iFrame.contentWindow.location.href;
    // remove possible anchor from url
    url = url.split('#')[0];
    console.log("Loaded new frame:\n" + url);
    // replace all external links with localhost extern links
    let docFrame = iFrame.contentDocument;
    aElems = docFrame.getElementsByTagName("A");
    for (let a of aElems) {
        let href = a.getAttribute("href");
        if (href && href.startsWith("http")) {
            a.href = "/extern/"+href;
        } 
    }

    // check if URL is course overview; if it is, add all links to courses
    if (url == iFrame.src) {
        setStatus("Course overview");
        let rootElems = docFrame.getElementsByClassName("bs_menu");
        for (let rootElem of rootElems) {
            for (let elem of rootElem.getElementsByTagName("A")) {
                courses[elem.href] = elem.innerHTML;
            }
        }
    } 
    else {
        // TODO check if URL is a course (or check contentDocument for that)
        if (Object.keys(courses).includes(url)) {
            setStatus("Choose " + courses[url] + " course to add", "white")
            // modify page
            // prevent all forms from submitting 
            for (let formElem of docFrame.forms) {
                formElem.onsubmit = () => false;
            }
            // insert buttons into book table cell
            for (let bookElem of docFrame.getElementsByClassName("bs_sbuch")) {
                if (bookElem.tagName != "TD")
                    continue;
                // check book button, remove it and save its color
                let className = "";
                let inputElems = bookElem.getElementsByTagName("INPUT");
                if (inputElems.length > 0) {
                    inputElems[0].type="text";
                    className = inputElems[0].className;
                }
                while (bookElem.lastChild)
                    bookElem.removeChild(bookElem.lastChild);
                let button = document.createElement("BUTTON");
                button.innerHTML = "ADD"; // TODO or remove if already added for that user
                button.className = className;
                button.style = "width:95%; height:25px;border-radius:5px;"
                bookElem.appendChild(button);
                button.onclick = () => onAdd(button);
            }
        } else {
            setStatus("Current Page is not a Course page", "white")
        }
    }
};


// fetch userdata and initialize user bar
setStatus("Fetching userdata...");
downloadUserData()
.then((d) => {userdata = d;})
.then(() => updateUserSelect(userSelectElem, userdata))
.then(() => setStatus("Fetched userdata."))