const inputSubImm = document.getElementById("submitimmediately");
const armButton = document.getElementById("armallbutton"); 
const storedDataElem = document.getElementById("storeduserdata");
const choiceElem = document.getElementById("choice");

let userdata;
let choice;
let armed = false;


function getHref(sport) {
	// TODO better implementation
	return "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_" + 
		sport.replace(" ", "_").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue") +
		 ".html";
}

function getErrorTable(nr, details, error) {
	const notAvailElem = document.getElementById("notavail").cloneNode(true);
	notAvailElem.getElementsByClassName("bs_sknr")[1].innerHTML = nr;
	notAvailElem.getElementsByClassName("bs_sdet")[1].innerHTML = details;
	notAvailElem.getElementsByClassName("bs_sbuch")[1].innerHTML = error;
	notAvailElem.removeAttribute("hidden");
	return notAvailElem;
}

// remove expired courses from choice and upload it 
async function cleanupChoice() {
	let changed = false;
	for (let sport of Object.keys(choice)) {
		for (let user of Object.keys(choice[sport])) {
			for (let idx = choice[sport][user].length-1; idx >= 0; idx--) {
				let id = choice[sport][user][idx];
				let [nr, dateStr] = id.split("_");
				let date = dateFromDDMMYY(dateStr); 
				// if start date is more than 8 months ago, remove the course from choice 
				if (Date.now() - date > 1000*60*60*24*30*8) {
					removeNrFromChoice(choice, sport, user, nr)
					changed = true;
				} 
			}
		}
	}
	if (changed)
		await upload(CHOICE_FILE, choice);
}

function removeObsoleteEntries() {
	for (let i = choiceElem.children.length - 1; i>= 0; i--) {
		let title = choiceElem.children[i].title;
    	let [sport, nr, user] = title.split("_");
		found = false;
		if (choice[sport] && choice[sport][user]) {
			for (let id of choice[sport][user])
				if (id.split("_")[0] == nr) {
					found = true;
					console.log("Found " + id + " for nr " + nr);
					break;
				}
		}
		if (!found)
			choiceElem.removeChild(choiceElem.children[i]);
	}
}

async function updateEntryInTable(entryElem, sport, nr, user) {
	const title = `${sport}_${nr}_${user}`;

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
		openOrSwitchToTab(getHref(sport)+"#K"+nr);
		window.close();
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


async function updateChoice(c) {
	choice = c ?? {};

	if (Object.keys(choice).length == 0)
		document.getElementById("armchoice").setAttribute("hidden", "");
	else
		document.getElementById("armchoice").removeAttribute("hidden");

	// remove table entries not in choice anymore
	removeObsoleteEntries();
	// add/update table entires in choice
	for (let sport of Object.keys(choice)) {
		// TODO display loading entry, like this?
		//let title = `${sport}_${nr}_${user}`;
		//let entryElem = getErrorTable(nr, title, "loading...");
		//await updateEntryInTable(entryElem, sport, nr, user); 

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
					entryElem.removeAttribute("id");
					entryElem.removeAttribute("hidden");
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
		})
		.then(() => {

		})

	}
}

async function updateUserdata(d) {
	// if userdata didn't change, do nothing
	if (userdata == d)
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

function updateArm(armedCourses) {
	let numArmedTitles = armedCourses.length;
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
}


function onCloseButton(button) {
    let parent = button.parentElement;
    while (parent.className != "item-page") {
        parent = parent.parentElement;
    }
    let title = parent.title;
    let [sport, nr, user] = title.split("_");

	// update choice file if removed successfully
 	if (removeNrFromChoice(choice, sport, user, nr)) {
		upload(CHOICE_FILE, choice)
		.then (() => {
			// TODO update bookedcourses file
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

function armAll() {
	armed = true;
	let user = Object.keys(userdata)[0];
	let courselist = [];
	for (let sport of Object.keys(choice)) {
		if (choice[sport][user])
			courselist.push(sport);
	}
	return storeAsArmedCourses(courselist)
	.then(() => onOpenAll(true));
}

function unarmAll() {
	armed = false;
    // clear armed list 
    return upload(ARMED_FILE, []);
}

function onArmAll() {
    if (!armed) 
		return armAll();  
    else 
		return unarmAll();
}

async function onOpenAll(checkAllOpenTabs=true, closeAfter=true) {
	let openHrefs = checkAllOpenTabs ? await getAllTabsHref() : [await getCurrentTabHref()]; 
	// remove anchors from hrefs 
	for (let i = 0; i < openHrefs.length; i++)
		openHrefs[i] = openHrefs[i].split("#")[0];

	let user = Object.keys(userdata)[0];
	let urls = [];

	for (let sport of Object.keys(choice)) {
		// get all tabs and don't reopen the ones already open
		if (choice[sport][user]) {
			let href = getHref(sport);		
			if (!openHrefs.includes(href)) {
				// create url with anchor to first course nr appended
				let nrs = [];
				choice[sport][user].forEach((id) => nrs.push(id.split("_")[0]));
				urls.push(href + "#K" + Math.min(...nrs));
			}
		}
	}
	urls.forEach((url) => window.open(url));
	if (closeAfter)
		window.close();
}


// Add listeners
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

// Load data sequentially
loadOptions()
.then(() => download(USERS_FILE).then(updateUserdata))
.then(
	// load choice, init table entries and remove expired courses
	() => download(CHOICE_FILE).then(updateChoice).then(cleanupChoice))
.then(() => download(ARMED_FILE).then(updateArm));

addStorageListener((changes) => {
	console.log("CHANGED:")
    console.log(changes);
    for (let item of Object.keys(changes)) {
        if (item == USERS_FILE) {
			updateUserdata(changes[USERS_FILE].newValue);
        } else if (item == ARMED_FILE) {
			updateArm(changes[ARMED_FILE].newValue);
        } else if (item == CHOICE_FILE) {
			updateChoice(changes[CHOICE_FILE].newValue);
        }
    }
});