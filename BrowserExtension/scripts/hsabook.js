const inputSubImm = document.getElementById("submitimmediately");
const armButton = document.getElementById("armallbutton"); 
const armText = document.getElementById("armbuttontext");
const storedDataElem = document.getElementById("storeduserdata");
const choiceElem = document.getElementById("choice");
const toggleAdviceButton = document.getElementById("toggleadvice");
const adviceElem = document.getElementById("advice");
const optionElem = document.getElementById("configuration");

let userdata = {};
let choice = {};
let armed = false;
let armedCourses = {};
let bookingState = {};

let courselinks = {};


function getHref(sport) {
	let link = courselinks[sport];
	// if link not registered, create it according to heuristic 
	if (!link)
		link = "_"+sport.replace(" ", "_").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss") +
		 ".html";
	return "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/" + link; 
}

function getErrorTable(id, details, error) {
	const notAvailElem = document.getElementById("notavail").cloneNode(true);
	notAvailElem.getElementsByClassName("bs_sknr")[1].innerText = id.split("_")[0];
	notAvailElem.getElementsByClassName("bs_sdet")[1].innerText = details;
	notAvailElem.getElementsByClassName("bs_sbuch")[1].innerText = error;
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
					changed = true;
					removeIdFromChoice(choice, sport, user, id)
					remove(BOOKSTATE_FILE+id);
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
    	let [sport, nr, date, user] = title.split("_");
		let entryId = nr+"_"+date;

		found = false;
		if (choice[sport] && choice[sport][user]) {
			for (let id of choice[sport][user])
				if (id == entryId) {
					found = true;
					break;
				}
		}
		if (!found)
			choiceElem.removeChild(choiceElem.children[i]);
	}
}

async function updateEntryInTable(entryElem, sport, id, user) {
	const title = `${sport}_${id}_${user}`;
	let nr = id.split("_")[0];

	// check if entry is already in table
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
	for (let cell of rowElem.children)
		cell.removeAttribute("style");

	replaceEntry.replaceChildren(...entryElem.children);
	// set close button listener
	let closeButton = replaceEntry.getElementsByClassName("closebutton")[0];
	closeButton.addEventListener("click", () => onCloseButton(closeButton));

	// Create href to course in the whole row
	let openCourseFun = () => {
		createTabIfNotExists(getHref(sport)+"#K"+nr, true)
		.then(window.close);
	}

	let newRowElem = replaceEntry.getElementsByTagName("TR")[1];
	for (let elem of newRowElem.children) {
		if (!elem.className.match("bs_sbuch")) {
			elem.addEventListener("click", openCourseFun);
			if (!elem.className.includes("link"))
				elem.className += " link";
		} else {
			elem.lastChild.addEventListener("click", openCourseFun);
			if (!elem.lastChild.className.includes("link"))
				elem.lastChild.className += " link";
		}
	}

	// Color entry if booked
	if (bookingState[id]) {
		if (bookingState[id][0] == "booked") {
			colorRow(newRowElem, "lime");
			// also change booking button
			for (let elem of newRowElem.getElementsByTagName("INPUT")) {
				elem.setAttribute("inert", "");
				elem.value = "GEBUCHT"; 
			}
		} 
		else if (bookingState[id][0] == "booking")
			colorRow(newRowElem, "lightblue");
		else if (bookingState[id][0] == "error") {
			colorRow(newRowElem, "darkorange");
			// also change booking button
			for (let elem of newRowElem.getElementsByTagName("INPUT")) {
				elem.value = "FEHLER"; 
			}
		}
	}
}

async function updateChoice(c) {
	choice = c ?? {};

	if (Object.keys(choice).length == 0) {
		document.getElementById("armchoice").setAttribute("hidden", "");
		document.getElementById("openchoicesite").removeAttribute("hidden");
	}
	else {
		document.getElementById("armchoice").removeAttribute("hidden");
		document.getElementById("openchoicesite").setAttribute("hidden", "");
	}

	// remove table entries not in choice anymore
	removeObsoleteEntries();
	// add/update table entires in choice
	for (let sport of Object.keys(choice)) {
		requestHTML("GET", getHref(sport))
		.then((sportDoc) => {
			for (let user of Object.keys(choice[sport])) {
				for (let id of choice[sport][user]) {
					let [nr, date] = id.split("_");
					// find corresponding row element matching nr
					let tRowElem; 
					for (let nrElem of sportDoc.getElementsByClassName("bs_sknr")) {
						if (nrElem.innerText == nr) {
							tRowElem = nrElem.parentElement;
							console.assert(tRowElem.tagName == "TR");
							break;
						}
					}
					if (!tRowElem)
						throw new Error("NR not found");
					else if (!getCourseDateStr(tRowElem) == date) {
						console.warn(`Found no date matching course ${sport}_${id}, skipping...`)
						continue;
					}	

					// create empty entry of table and insert course data
					let entryElem = document.getElementById("notavail").cloneNode(true);
					entryElem.removeAttribute("id");
					entryElem.removeAttribute("hidden");
					let bodyElem = entryElem.getElementsByTagName("TBODY")[0];
					bodyElem.replaceChildren(tRowElem);
					let newRowElem = bodyElem.lastChild;
					// Remove some table cells from the row
					for (let i = newRowElem.children.length-1; i >= 0; i--) {
						let cellElem = newRowElem.children[i];
						if (!["bs_sknr", "bs_sbuch", "bs_sdet", "bs_stag", "bs_szeit", "bs_szr"].includes(cellElem.className))
							newRowElem.removeChild(cellElem);
						if (cellElem.className == "bs_szr")
							for (let anchor of cellElem.getElementsByTagName("A"))
								anchor.removeAttribute("href");

					}
					// append sport to details (bs_sdet)
					let detElem = newRowElem.getElementsByClassName("bs_sdet")[0];
					if (detElem)
						detElem.innerText = sport + " - " + detElem.innerText; // + " (" + user + ")";
					updateEntryInTable(entryElem, sport, id, user); 
				}
			}
		})
		.catch((err) => {
			for (let user of Object.keys(choice[sport])) {
				for (let id of choice[sport][user]) {
					let title = `${sport}_${id}_${user}`;
					let entryElem = getErrorTable(id, title, err);
					updateEntryInTable(entryElem, sport, id, user); 
				}
			}
		});
	}
}

function updateBooked(courseID, statestampArr) {
	let [oldState, oldStamp] = bookingState[courseID] ?? [undefined, 0];
	let [state, newStamp] = statestampArr ?? [undefined, 0]
	if (!statestampArr)
		delete bookingState[courseID];
	else
		bookingState[courseID] = statestampArr; 

	// check if state has changed / expired state has become unexpired
	if (state == oldState && 
			!(oldState =="booking" && hasExpired(oldStamp, booking_expiry_msec)))
		return;

	// find element in table and change it
	for (let tableEntry of choiceElem.children) {
		let [sport, nr, date, user] = tableEntry.getAttribute("title").split("_"); 
		let id = nr+"_"+date;

		if (id == courseID) {
			if (state) {  // if state is not undefined, update it
				updateEntryInTable(tableEntry, sport, id, user);
			} else if (oldState) { // entry's booking state was removed
				if (oldState == "booked") {
					// Todo revert changes to book button
				} 
				let tRow = tableEntry.getElementsByTagName("TD")[0].parentElement;
				colorRow(tRow, "none");
			}
			return;
		}
	}
}

async function updateUserdata(d) {
	// if userdata didn't change, do nothing
	if (userdata == d)
		return;
	userdata = d ?? {};

	if (Object.keys(userdata).length == 0) {
		storedDataElem.setAttribute("hidden", "");
		document.getElementById("edituserbutton").children[0].innerText = "Add User";
	} else {
		storedDataElem.removeAttribute("hidden");
		document.getElementById("edituserbutton").children[0].innerText = "Edit User data";
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

async function updateArm() {
	// TODO check for expiry when counting titles?
	let numArmedTitles = Object.keys(armedCourses).length;  
	// set arm Button and text according to whether all are armed or not
	if (numArmedTitles == 0) {
		armText.innerText = "Arm all";
		let style = armButton.getAttribute("style").replace("blue", "green");
		armButton.setAttribute("style", style); 
		armed = false;
	}
	else if (numArmedTitles == Object.keys(choice).length) {
		armText.innerText = "Unarm all";
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
    let [sport, nr, date, user] = title.split("_");
	let id = nr+"_"+date;

	// update choice file if removed successfully
 	if (removeIdFromChoice(choice, sport, user, id)) {
		upload(CHOICE_FILE, choice)
		.then (() => {
			remove(BOOKSTATE_FILE+id);
		});
    } else {
		console.error("Could not remove course " + nr + ": Not found in choice!");
	}
    return false;
}


function onOptionChange(change) {
	// set changed options
	let optionObj = {};
	for (let inputElem of optionElem.getElementsByTagName("INPUT")) {
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
	for (let inputElem of optionElem.getElementsByTagName("INPUT")) {
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
	.then(() => onOpenAll(false));
}

function unarmAll() {
	armed = false;
	let user = Object.keys(userdata)[0];
	let courselist = [];
	for (let sport of Object.keys(choice)) {
		if (choice[sport][user])
			courselist.push(sport);
	}
    return storeAsUnarmed(courselist); 
}

function onArmAll() {
    if (!armed) 
		return armAll();  
    else 
		return unarmAll();
}

async function onOpenAll(closeAfter=false) {
	let user = Object.keys(userdata)[0];
	let urls = [];
	let currentTab = (await getCurrentTabHref()).split("#")[0];
	let isCurrentTabIncluded = false;

	for (let sport of Object.keys(choice)) {
		// get all tabs and don't reopen the ones already open
		if (choice[sport][user]) {
			let href = getHref(sport);
			if (href == currentTab) 
				isCurrentTabIncluded = true;
			// create url with anchor to first course nr appended
			let nrs = [];
			choice[sport][user].forEach((id) => nrs.push(id.split("_")[0]));
			urls.push(href + "#K" + Math.min(...nrs));
		}
	}
	// only switch to last tab if the current tab is not a course tab (isCurrentTabIncluded)
	// and if the popup window should be closed after opening all
	let switchToLast = (closeAfter && !isCurrentTabIncluded); 
	for (let i = 0; i < urls.length; i++)
		await createTabIfNotExists(urls[i], i == urls.length-1 && switchToLast);
	if (closeAfter)
		window.close();
}


// Add listeners
for (let inputElem of optionElem.getElementsByTagName("INPUT")) {
	inputElem.addEventListener("change", onOptionChange);
}

document.getElementById("resetdata").addEventListener("click", () => {
	if (confirm("Reset HSA Booker extension?")) {
			base.storage.local.clear();
			base.storage.sync.clear();
	}
})
document.getElementById("go-to-options").addEventListener("click", () => {
    window.open("hsabook_options.html");
})
document.getElementById("go-to-options").onClick = () => {
  window.open("hsabook_options.html");
};

document.getElementById("armall").addEventListener("click", onArmAll);
document.getElementById("openall").addEventListener("click", onOpenAll);

loadOptions();

// Load local storage and clean it up
async function loadInitialData() {
	let storageContent = await downloadAll();
	console.log(storageContent);

	courselinks = storageContent[COURSELINKS_FILE] ?? {};
	updateUserdata(storageContent[USERS_FILE]);
	updateChoice(storageContent[CHOICE_FILE]);

	for (let file of Object.keys(storageContent)) {
		if (file.startsWith(ARMED_FILE)) {
			let stamp = storageContent[file];
			if (hasExpired(stamp, armed_expiry_msec))
				remove(file);
			else 
				armedCourses[file.substring(ARMED_FILE.length)] = stamp;
		} else if (file.startsWith(BOOKSTATE_FILE)) {
			let statestamp = storageContent[file];
			let courseID = file.substring(BOOKSTATE_FILE.length);
			let [state, stamp] = statestamp ?? [undefined, 0];
			// remove file if state has expired, i.e. is more than 8 months old
			if (hasExpired(stamp, 8*31*24*3600*1000) || (state == "booking" && hasExpired(stamp, booking_expiry_msec)))
				remove(file);
			else
				updateBooked(courseID, statestamp);
		}
	}
	updateArm();

	cleanupChoice();

	addStorageListener((changes) => {
		console.log("[Storage Listener] Change:")
		console.log(changes);
		for (let item of Object.keys(changes)) {
			if (item == USERS_FILE) {
				updateUserdata(changes[USERS_FILE].newValue);
			} else if (item.startsWith(ARMED_FILE)) {
				if (changes[item].newValue)
					armedCourses[item.substring(ARMED_FILE.length)] = changes[item].newValue;
				else
					delete armedCourses[item.substring(ARMED_FILE.length)];
				updateArm();
			} else if (item == CHOICE_FILE) {
				updateChoice(changes[CHOICE_FILE].newValue);
			} else if (item.startsWith(BOOKSTATE_FILE)) {
				let courseID = item.substring(BOOKSTATE_FILE.length);
				updateBooked(courseID, changes[item].newValue);
			}
		}
	});

	// update course links 
	requestHTML("GET", "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/")
	.then((doc) => {
			let rootElems = doc.getElementsByClassName("bs_menu");
			for (let rootElem of rootElems) {
				for (let elem of rootElem.getElementsByTagName("A")) {
					courselinks[elem.innerText] = elem.href.split("/").pop();
				}
			}
			upload(COURSELINKS_FILE, courselinks);
			console.log("Fetched course links:");
			console.log(courselinks);
		})
	.catch((err) => {
		console.error("Failed to update course links: Loading course site failed");
	});	
}

loadInitialData();

// Create function that periodically checks whether a booking state has expired
setInterval(() => {
	for (let id of Object.keys(bookingState)) {
		let [state, stamp] = bookingState[id];
		if (state == "booking" && hasExpired(stamp, booking_expiry_msec)) {
			updateBooked(id, null);
		}
	}
}, 1000);

toggleAdviceButton.addEventListener("click", () => {
	if (adviceElem.getAttribute("hidden") == "") {
		adviceElem.removeAttribute("hidden");
		toggleAdviceButton.innerText = "Hide";
	} else {
		adviceElem.setAttribute("hidden", "");
		toggleAdviceButton.innerText = "Show advice";
	}
})

document.getElementById("titlelink").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));
document.getElementById("openchoicesite").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));
