let userdata;
let choice;
let courses = {};

const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const iFrame = document.getElementById("iframe");
const hintElem = document.getElementById("hint");


async function addCourse(user) {
    // get data from form
    let data = {};

    return download(USERS_FILE).then(() => {
        userdata[user] = data;
    }).then(() => upload(USERS_FILE, userdata));
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
            return;
        }
    }
    modifyBookButtons();
}

function getCurrentSport() {
    try {
        // remove possible anchor from url
        return courses[iFrame.contentWindow.location.href.split('#')[0]];
    } catch {
        return undefined;
    }
}

async function onAdd(button) {
    let add = button.innerHTML == "ADD";
    let user = getSelectedUser(userSelectElem);
    if (!user) {
        alert("Select a user to add the course for in the top left corner first.")
        return;
    }

    let sport = getCurrentSport();

    // find nr
    let trElem = button.parentElement.parentElement;
    let nr = trElem.getElementsByClassName("bs_sknr")[0].innerHTML;

    // confirm if course is already full
    if (add && button.className == "bs_btn_ausgebucht")
        if (!confirm("Course is already full. Add nevertheless?"))
            return;

    setStatus("Fetching most recent choice data...");
    return download(CHOICE_FILE).then((d) => {
        choice = d;
        if (add) {
            if (!choice[sport])
                choice[sport] = {};
            if (!choice[sport][user])
                choice[sport][user] = [];
            choice[sport][user].push(nr);
        } else {
            if (choice[sport] && choice[sport][user] && choice[sport][user].includes(nr)) {
                choice[sport][user].splice(choice[sport][user].indexOf(nr), 1);
                if (choice[sport][user].length == 0) {
                    delete choice[sport][user];
                    if (Object.keys(choice[sport]).length == 0)
                        delete choice[sport];
                }
            } else  {
                throw new Error("Course " + nr + "is not added for user");
            }
        }
        setStatus("Updating user data...");
    }).then(() => upload(CHOICE_FILE, choice))
    .then((d) => choice = d) 
    .then( () => {
        console.log("New choice data:");
        console.log(choice);
        modifyBookButtons();
        if (add && choice[sport] && choice[sport][user] && choice[sport][user].includes(nr))
            setStatus("Added course " + nr + " for user " + user + ".", "green");
        else if (!add && (!choice[sport] || !choice[sport][user] || !choice[sport][user].includes(nr)))
            setStatus("Removed course " + nr + " from user " + user + ".", "green");
        else
            throw new Error("Choice is unchanged");
    })
    .catch( (err) => {
        if (add)
            setStatus("Failed to add title: " + err.text, "red");
        else
            setStatus("Failed to delete title: " + err.text, "red");
        console.log(err);
    });
}

iFrame.onload =  
() => {
    let url;
    try {
        url = iFrame.contentWindow.location.href;
    } catch {
        alert("The link you clicked on is not supported.");
        iFrame.contentWindow.location.href = iFrame.src;
        return;
    }
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
        let rootElems = docFrame.getElementsByClassName("bs_menu");
        courses = {};
        for (let rootElem of rootElems) {
            for (let elem of rootElem.getElementsByTagName("A")) {
                courses[elem.href] = elem.innerHTML;
            }
        }
    } 

    // set hint elem status depending on url
    if (courses[url]) { // check if URL is a course
        setStatus("Choose " + courses[url] + " course to add", "white")
        hintElem.innerHTML = "Click on the book button to add the course for the selected user";
        // modify page
        // prevent all forms from submitting 
        for (let formElem of docFrame.forms) {
            formElem.onsubmit = () => false;
        }
        // add new column to each table
        let tHeadElems = iFrame.contentDocument.getElementsByTagName("THEAD");
        for (let tHead of tHeadElems) {
            let tRows = tHead.getElementsByTagName("TR");
            for (let tRow of tRows)
                tRow.innerHTML += '<th style="text-align:center">Aktion</th>'
        }
        let tBodyElems = iFrame.contentDocument.getElementsByTagName("TBODY");
        for (let tBody of tBodyElems) {
            let tRows = tBody.getElementsByTagName("TR");
            for (let tRow of tRows)
                tRow.innerHTML += '<td class="aktion" style="text-align:center;vertical-align:center;width:84px;"></td>'
        }
        modifyBookButtons();
    } else if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
        setStatus("Course overview");
        hintElem.innerHTML = "Go to a course website to add the course";
    } else { 
        setStatus("Current Page is not a Course page", "white")
    }
};

function modifyBookButtons() {

    let sport = getCurrentSport();
    let user = getSelectedUser(userSelectElem);
    let nrlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user] : [];
    // insert buttons into book table cell
    for (let bookElem of iFrame.contentDocument.getElementsByClassName("bs_sbuch")) {
        if (bookElem.tagName != "TD")
            continue;
        // check book button and save its color (by classname)
        let className = "";
        let childElem = bookElem.lastChild;
        if (["BUTTON", "INPUT"].includes(childElem.tagName)) {
            className = childElem.className;
        }
        // get corresponding course nr
        let trElem = bookElem.parentElement;
        let nr = trElem.getElementsByClassName("bs_sknr")[0].innerHTML;
        let aktionElem = bookElem.parentElement.lastChild;
        // remove content of aktionElem
        while (aktionElem.lastChild)
            aktionElem.removeChild(aktionElem.lastChild);
        // create button and add to bookElem
        let button = iFrame.contentDocument.createElement("BUTTON");
        button.innerHTML = nrlist.includes(nr) ? "REMOVE" : "ADD"; 
        //button.className = className;
        button.style = "width:95%; height:25px;border-radius:5px;text-align:center;"
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button);
    }
}


// fetch userdata and initialize user bar
setStatus("Fetching data...");
download(CHOICE_FILE)
.then((d) => {choice = d; console.log(choice);})
.then(() => setStatus("Fetched choice."))
.then(() => download(USERS_FILE))
.then((d) => {userdata = d;})
.then(() => updateUserSelect(userSelectElem, userdata))
.then(() => setStatus("Fetched userdata."));