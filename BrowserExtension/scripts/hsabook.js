const inputSubImm = document.getElementById("submitimmediately");
const armButton = document.getElementById("armallbutton"); 

let userdata = {};
let choice = {};
let statusElements = {};

async function updateUser() {
	const storedDataElem = document.getElementById("storeduserdata");
	let d = await download(USERS_FILE);
	if (userdata && userdata == d)
		return;
	userdata = d ?? {};

	if (Object.keys(userdata).length == 0) {
		storedDataElem.setAttribute("hidden", "");
		document.getElementById("edituserbutton").children[0].innerHTML = "Add User";
	} else {
		storedDataElem.removeAttribute("hidden");
		document.getElementById("edituserbutton").children[0].innerHTML = "Edit User data";
		let data = userdata[Object.keys(userdata)[0]];
		// Set status select input
		let selectElem = document.getElementById("usershowelem");
		let ok = false;
		for (let i = 0; i < selectElem.options.length; i++) {
			if (selectElem.options[i].value == data.statusorig) {
				selectElem.selectedIndex = i;
				selectElem.dispatchEvent(new Event("change"));
				ok = true;
				break;
			}
		}
		// fill other data
		let inputElems = storedDataElem.getElementsByTagName("INPUT");
		for (let inputElem of inputElems) {
			// fill form data
			if (data[inputElem["name"]] != undefined)
					inputElem.value = data[inputElem["name"]];
		}
	}
}

function getErrorTable(nr, details, error) {
	const notAvailElem = document.getElementById("notavail").cloneNode(true);
	notAvailElem.getElementsByClassName("bs_sknr")[1].innerHTML = nr;
	notAvailElem.getElementsByClassName("bs_sdet")[1].innerHTML = details;
	notAvailElem.getElementsByClassName("bs_sbuch")[1].innerHTML = error;
	notAvailElem.removeAttribute("hidden");
	return notAvailElem;
}

async function updateEntryInTable(entryElem, sport, nr, user) {
	const title = `${sport}_${nr}_${user}`;
	const choiceElem = document.getElementById("choice");

	// check if nr is already in table
	let replaceEntry;
	for (let tableEntry of choiceElem.children) {
		if (tableEntry.getAttribute("title") == title) {
			replaceEntry = tableEntry;
			break;
		}
	}
	if (!replaceEntry) {
		choiceElem.appendChild(entryElem.cloneNode(true));
		replaceEntry = choiceElem.lastChild; 
		replaceEntry.setAttribute("title", title);
	}
	// replace tableRow with entryHTML input appended with the old status bar 
	const rowElem = replaceEntry.getElementsByTagName("TR")[1];
	// clear row for 100msec for visual effect of refresh
	for (let cell of rowElem.children)
		cell.setAttribute("style", "color: white;");
	await sleep(100);

	replaceEntry.innerHTML = entryElem.innerHTML;
	// set close button listener
	let closeButton = replaceEntry.getElementsByClassName("closebutton")[0];
	closeButton.addEventListener("click", () => onCloseButton(closeButton));

	// Create href to course in the whole row
	let openCourseFun = () => {
		window.open(getHref(sport)+"#K"+nr);
	}
	for (let elem of replaceEntry.getElementsByTagName("TR")[1].children) {
		if (!elem.className.match("bs_sbuch")) {
			elem.addEventListener("click", openCourseFun);
			elem.className += " link";
		} else {
			elem.lastChild.addEventListener("click", openCourseFun);
			elem.lastChild.className += " link";
		}
	}
}


async function updateChoice() {
	if (Object.keys(choice).length == 0)
		document.getElementById("armchoice").setAttribute("hidden", "");
	else
		document.getElementById("armchoice").removeAttribute("hidden");

	for (let sport of Object.keys(choice)) {
		requestHTML("GET", getHref(sport))
		.then((sportDoc) => {
			for (let user of Object.keys(choice[sport])) {
				for (let id of choice[sport][user]) {
					let [nr, date] = id.split("_");
					// find corresponding  row element matching nr
					let tRowElem; 
					for (let nrElem of sportDoc.getElementsByClassName("bs_sknr")) {
						if (nrElem.innerHTML == nr) {
							tRowElem = nrElem.parentElement;
							console.assert(tRowElem.tagName == "TR");
							break;
						}
					}
					if (!tRowElem)
						throw new Error("NR not found");
					else if (!getCourseDateStr(tRowElem) == date)	
						throw new Error("Course start that does not match!") //TODO: no error, just ignore it or remove from choice

					// create empty entry of table and insert course data
					let entryElem = document.getElementById("notavail").cloneNode(true);
					let bodyElem = entryElem.getElementsByTagName("TBODY")[0];
					bodyElem.innerHTML = tRowElem.outerHTML;
					let newRowElem = bodyElem.lastChild;
					// Remove some table cells from the row
					for (let i = newRowElem.children.length-1; i >= 0; i--) {
						let cellElem = newRowElem.children[i];
						if (!["bs_sknr", "bs_sbuch", "bs_sdet", "bs_stag", "bs_szeit"].includes(cellElem.className))
							newRowElem.removeChild(cellElem);
					}
					// append sport to details (bs_sdet)
					let detElem = newRowElem.getElementsByClassName("bs_sdet")[0];
					if (detElem)
						detElem.innerHTML = sport + " - " + detElem.innerHTML; // + " (" + user + ")";
					updateEntryInTable(entryElem, sport, nr, user); 
				}
			}
		})
		.catch((err) => {
			for (let user of Object.keys(choice[sport])) {
				for (let nr of choice[sport][user]) {
					let title = `${sport}_${nr}_${user}`;
					let entryElem = getErrorTable(nr, title, err);
					updateEntryInTable(entryElem, sport, nr, user); 
				}
			}
		});
	}
}

function onCloseButton(button) {
    let parent = button.parentElement;
    while (parent.className != "item-page") {
        parent = parent.parentElement;
    }
    let title = parent.title;
	console
    let [sport, nr, user] = title.split("_");
	console.log(sport, nr, user);

    if (choice[sport] && choice[sport][user] && choice[sport][user].includes(nr)) {
		// remove nr from choice and remove element from list
        choice[sport][user].splice(choice[sport][user].indexOf(nr), 1);
		parent.parentElement.removeChild(parent);
		// clean up choice obj
        if (choice[sport][user].length == 0) {
            delete choice[sport][user];
            if (Object.keys(choice[sport]).length == 0)
                delete choice[sport];
        }
        // update choice file
        upload(CHOICE_FILE, choice)
        .then((data) => { 
            choice = data;
        })
        .then (() => {
            // update bookedcourses file
            console.log("Trying to remove course " + nr + " from booked courses...");
            return download(BOOKSTATE_FILE)
            .then((bookedCourses) => {
				if (bookedCourses && bookedCourses.includes(nr)) {
					bookedTitles.splice(bookedCourses.indexOf(nr), 1);
					upload(BOOKSTATE_FILE, bookedTitles);
				}
            });
        });
    } else {
		console.error("Could not remove course " + nr + ": Not found in choice!");
	}
    return false;
}



function onOptionChange(change) {
	console.log(change);
	// set changed options
	let optionObj = {};
	for (let inputElem of document.getElementsByTagName("INPUT")) {
		if (inputElem.type == "radio") {
			if (inputElem.checked) {
				optionObj[inputElem.name] = inputElem.value;
			}
		} else if (inputElem.type == "checkbox") {
			optionObj[inputElem.name] = inputElem.checked;
		} else {
			optionObj[inputElem.name] = inputElem.value;
		}
	}

/*
	if (optionObj["mode"] == "formonly") {
		inputSubImm.setAttribute("hidden", "");
	} else {
		inputSubImm.removeAttribute("hidden");
		inputSubImm.checked = false;
		optionObj[inputSubImm.name] = false;
	}
*/
	setAllOptions(optionObj);
}

async function loadOptions() {
	for (let inputElem of document.getElementsByTagName("INPUT")) {
		if (inputElem.type == "radio") {
			inputElem.checked = await getOption(inputElem.name) == inputElem.value;
		} else if (inputElem.type == "checkbox") {
			inputElem.checked = await getOption(inputElem.name);
		} else {
			inputElem.value = await getOption(inputElem.name);
		}
	}

/*	
	if (getOption("mode") == "formonly") {
		inputSubImm.setAttribute("hidden", "");
	} else {
		inputSubImm.removeAttribute("hidden");
		inputSubImm.checked = false;
	}
*/
}


function getHref(sport) {
	// TODO better implementation
	return "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_" + 
		sport.replace(" ", "_").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue") +
		 ".html";
}


let armed = false;

function onArmAll() {
    armed = !armed;
    if (armed) {
		let user = Object.keys(userdata)[0];
		let courselist = [];
		for (let sport of Object.keys(choice)) {
			if (choice[sport][user])
				courselist.push(sport);
		}
		storeAsArmedCourses(courselist)
		.then(() => onOpenAll(true));
    } else {
        // clear armed list 
        upload(ARMED_FILE, []);
    }
}

function onOpenAll(checkAllOpenTabs=true) {
	download(CHOICE_FILE).then((d) => {
		choice = d ?? {};
	}).then(async ()=> {
		let hrefs = checkAllOpenTabs ? await getAllTabsHref() : [await getCurrentTabHref()]; 
		// remove anchors from hrefs 
		for (let i = 0; i < hrefs.length; i++)
			hrefs[i] = hrefs[i].split("#")[0];

		let user = Object.keys(userdata)[0];
		for (let sport of Object.keys(choice)) {
			// get all tabs and don't reopen the ones already open
			if (choice[sport][user]) {
				let href = getHref(sport);		
				if (!hrefs.includes(href)) // open href with anchor to first course nr appended
					window.open(getHref(sport) + "#K" + Math.min(...choice[sport][user]));
			}
		}
	});
}


for (let inputElem of document.getElementsByTagName("INPUT")) {
	inputElem.addEventListener("change", onOptionChange);
}


document.getElementById("go-to-options").addEventListener("click", () => {
    console.log("Click event!");
    window.open("hsabook_options.html");
})
document.getElementById("go-to-options").onClick = () => {
  window.open("hsabook_options.html");
};


armButton.addEventListener("click", onArmAll);
document.getElementById("openall").addEventListener("click", onOpenAll);

loadOptions();
updateUser();

download(CHOICE_FILE).then(async (d) => {
	choice = d ?? {};
	for (let sport of Object.keys(choice)) {
		for (let user of Object.keys(choice[sport])) {
			for (let idx = choice[sport][user].length-1; idx >= 0; idx--) {
				let id = choice[sport][user][idx];
				let [nr, dateStr] = id.split("_");
				let date = dateFromDDMMYY(dateStr); 
				// if start date is more than 8 months ago, remove the course from choice 
				if (Date.now() - date > 1000*60*60*24*30*8) {
					choice[sport][user].splice(idx, 1);
					if (choice[sport][user].length == 0) {
						delete choice[sport][user];
						if (Object.keys(choice[sport].length == 0))
							delete choice[sport];
					}
					await upload(CHOICE_FILE, choice);
					continue;
				} 
				// Otherwise create table entry
				let title = `${sport}_${nr}_${user}`;
				let entryElem = getErrorTable(nr, title, "loading...");
				await updateEntryInTable(entryElem, sport, nr, user); 
			}
		}
	}
	updateChoice();
});

addStorageListener((changes) => {
	console.log("CHANGED:")
    console.log(changes);
    for (let item of Object.keys(changes)) {
        if (item == USERS_FILE) {
			updateUser();
        } else if (item == ARMED_FILE) {
			let numArmedTitles = changes[ARMED_FILE].newValue.length;
			// set arm Button and text according to whether all are armed or not
    		const armText =  document.getElementById("armbuttontext");
            if (numArmedTitles == 0) {
				console.log("Resetting arm button..")
        		armText.innerHTML = "Arm all marked courses";
		        let style = armButton.getAttribute("style").replace("blue", "green");
 	 	        armButton.setAttribute("style", style); 
				armed = false;
			}
			else if (numArmedTitles == Object.keys(choice).length) {
				console.log("Setting arm button..")
        		armText.innerHTML = "Unarm all marked courses";
		        let style = armButton.getAttribute("style").replace("green", "blue");
		        armButton.setAttribute("style", style); 
				armed = true;
			}
        } else if (item == CHOICE_FILE) {
			choice = changes[item].newValue ?? {};
			updateChoice();
        }
    }
});