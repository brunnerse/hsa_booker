let userdata;
let choice;
const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const armButton = document.getElementById("armbutton"); 
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

async function onSelectChange() {
    let selectedUser = getSelectedUser(userSelectElem);
    if (selectedUser == "") {
        if (userSelectElem.options[userSelectElem.selectedIndex].title == "adder") {
            // open user edit page in new tab
            // Opening extension directly doesnt work; make alert instead
            //window.open(chrome.runtime.getURL("Users.html"));
            alert("To add users, click on the HSA Booker icon on the top right and click \"Edit User Data\".")
            // reset selection to the first blank one
            setSelectedUserIdx(userSelectElem, await getOption("defaultuseridx"));
            return;
        }
    }
    modifyBookButtons();
}

function getCurrentSport() {
    try {
        let lastPath = window.location.href.match(/[A-Z][\w_]+\.html/)[0];
        let sport = lastPath.split(".")[0].replace("_", " ");
        return sport;
        // or other way:
//        let headElem = document.getElementsByClassName("bs_head")[0];
//        return headElem.innerHTML; 
    } catch {
        return undefined;
    }
}

async function onAdd(button) {
    let add = button.innerHTML.startsWith("MARK FOR BOOKING");
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
        choice = d ?? {};
        if (add) {
            if (!choice[sport])
                choice[sport] = {};
            if (!choice[sport][user])
                choice[sport][user] = [];
            console.log(choice);
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

function onArm() {
    console.log("ARM clicked.")
}

window.onload =  
() => {
    let url;
    try {
        url = window.location.href;
    } catch {
        alert("The link you clicked on is not supported.");
        setStatus("Not supported link");
        return;
    }
    // remove possible anchor from url
    url = url.split('#')[0];
    console.log("Loaded new frame:\n" + url);

    // check if URL is a course
    if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\/_[A-Z]\w+/)) {
        let course = getCurrentSport(); 
        setStatus("Choose " + course + " course to add", "white")
        hintElem.innerHTML = "Click on the book button to add the course for the selected user";
        // modify page
        modifyBookButtons();
    } else if (url.match(/\w*:\/\/anmeldung.sport.uni-augsburg.de\/angebote\/aktueller_zeitraum\//)) {
        setStatus("Course overview");
        hintElem.innerHTML = "Go to a course website to add the course";
    } else {
        setStatus("Not a course website", "white");
    }
};

function modifyBookButtons() {
    let sport = getCurrentSport();
    let user = getSelectedUser(userSelectElem);
    let nrlist = user && sport && choice[sport] && choice[sport][user] ? choice[sport][user] : [];
    // insert buttons into book table cell
    for (let bookElem of document.getElementsByClassName("bs_sbuch")) {
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
        let button = document.createElement("BUTTON");
        button.innerHTML = nrlist.includes(nr) ? "MARKED" : "MARK FOR BOOKING"; 
        //button.className = className;
        button.style = "width:95%; border-radius:5px;text-align:center;" 
            + (nrlist.includes(nr) ? "background-color: green;" : "");
        button.type = "button";
        aktionElem.appendChild(button);
        button.onclick = () => onAdd(button);
    }
}

console.log("USEREL:")
console.log(userSelectElem);
userSelectElem.addEventListener("change", onSelectChange);
armButton.addEventListener("click", onArm);


// fetch userdata and initialize user bar
download(CHOICE_FILE)
.then((d) => {
    if (d && Object.keys(d).length > 0) {
        console.log("CHOICE: ")
        choice = d; console.log(choice);
    } else {
        choice = {};
        console.log("Choice not stored");
    }
})    
.catch((err) => {
    choice = {};
    console.error("Error during reading storage:");
    console.error(err);
})
.then(() => download(USERS_FILE))
.then((d) => {userdata = d;})
.then(() => updateUserSelect(userSelectElem, userdata));