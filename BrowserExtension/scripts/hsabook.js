const inputSubImm = document.getElementById("submitimmediately");
const inputFill = document.getElementById("fillform");
const armButton = document.getElementById("armallbutton"); 
const armText = document.getElementById("armbuttontext");
const storedDataElem = document.getElementById("storeduserdata");
const choiceElem = document.getElementById("choice");
const toggleAdviceButton = document.getElementById("toggleadvice");
const adviceElem = document.getElementById("advice");
const optionElem = document.getElementById("configuration");
const emptyTableElem = document.getElementById("notavail");

let userdata = {};
let choice = {};
let armed_all = false;
let armed_one = false;
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

function createEmptyCourseTable() {
	const elem = emptyTableElem.cloneNode(true);
	elem.removeAttribute("id");
	elem.removeAttribute("hidden");
	return elem;
}

function getErrorTable(id, details, errorStr) {
	const notAvailElem = createEmptyCourseTable(); 
	notAvailElem.getElementsByClassName("bs_sknr")[1].innerText = id.split("_")[0];
	notAvailElem.getElementsByClassName("bs_sdet")[1].innerText = details;
	notAvailElem.getElementsByClassName("bs_szr")[1].innerText = id.split("_")[1];
	notAvailElem.getElementsByClassName("bs_sbuch")[1].children[0].value = errorStr;
	return notAvailElem;
}

// remove expired courses from choice and upload it 
async function cleanupChoice(expiry_msec) {
	let changed = false;
	for (let sport of Object.keys(choice)) {
		for (let user of Object.keys(choice[sport])) {
			for (let idx = choice[sport][user].length-1; idx >= 0; idx--) {
				let id = choice[sport][user][idx];
				let [nr, dateStr] = id.split("_");
				let date = dateFromDDMMYY(dateStr); 
				// if start date is too long ago, remove the course from choice 
				if (Date.now() - date > expiry_msec) {
					console.log(`Removing course Nr. ${nr} (${sport}, started at ${dateStr}) as it is in the past.`)
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
		// Find correct position: Sort by sport and nr, booked courses first 
		let isEntryBooked = (bookingState[id] ?? [null])[0] == "booked";
		let i;
		for (i = 0; i < choiceElem.children.length; i++) {
			let [compSport, compNr, compDate, __] = 
				choiceElem.children[i].getAttribute("title").split("_");
			let compIsBooked = (bookingState[compNr+"_"+compDate] ?? [null])[0] == "booked";
			if (isEntryBooked && !compIsBooked)
				break;
			else if (!isEntryBooked && compIsBooked)
				continue; 
			else if (compSport > sport || (compSport == sport && parseInt(compNr) > parseInt(nr)))
				break; 
		}
		choiceElem.insertBefore(entryElem.cloneNode(true), choiceElem.children[i]);
		replaceEntry = choiceElem.children[i]; 
		replaceEntry.setAttribute("title", title);
	}
	// replace the replaceEntry tableRow with entryElem
	replaceEntry.replaceChildren(...entryElem.children);
	// set close button listener
	let closeButton = replaceEntry.getElementsByClassName("closebutton")[0];
	closeButton.addEventListener("click", () => onCloseButton(closeButton));

	// Create href to course in the row if entry is not already a link or in error state
	let newRowElem = replaceEntry.getElementsByTagName("TR")[1];
	if (!newRowElem.className.match("link|err")) {
		newRowElem.className = "link " + newRowElem.className;
		newRowElem.addEventListener("click", 
			() => createTabIfNotExists(getHref(sport)+"#K"+nr, true)
			.then(window.close)
		);
	}

	// Set bookingState to full if course if full and bookingState is error or none
	let bookButtonElems = newRowElem.getElementsByTagName("INPUT");
	let bookButton = (bookButtonElems.length > 0) ? bookButtonElems[0] : null; 
	let bookButtonClass = (bookButtonElems.length > 0) ? bookButtonElems[0].className : ""; 
    if (["bs_btn_ausgebucht", "bs_btn_warteliste"].includes(bookButtonClass)) {
		if (!bookingState[id] || bookingState[id][0] == "error") {
			bookingState[id] = ["full", Infinity];
		}	
	}
	// Color entry depending on the course's booking state
	if (bookingState[id])
	{
		colorRow(newRowElem, bookingState[id][0]);
		// change book button text for some states
		if (bookButton) {
			if (bookingState[id][0] == "booked") {
				bookButton.value = "Booked";
			} else if (bookingState[id][0] == "error") {
				bookButton.value = "Booking error"; 
			} else if (bookingState[id][0] == "booking") {
				bookButton.value = "Booking..."; 
			}
		}
	}
	setEntryArmStatus(replaceEntry);
}

async function updateChoice(c, initElems=false) {
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
		if (initElems) {
			for (let user of Object.keys(choice[sport])) {
				for (let id of choice[sport][user]) {
					let title = `${sport}`;
					let entryElem = getErrorTable(id, title, "Loading...");
					updateEntryInTable(entryElem, sport, id, user);
				}
			}
		}
		requestHTML("GET", getHref(sport))
		.then((sportDoc) => {
			for (let user of Object.keys(choice[sport])) {
				for (let id of choice[sport][user]) {
					let [nr, date] = id.split("_");
					// find corresponding row element matching nr
					let tRowElem = null; 
					for (let nrElem of sportDoc.getElementsByClassName("bs_sknr")) {
						if (nrElem.innerText == nr) {
							tRowElem = nrElem.parentElement;
							console.assert(tRowElem.tagName == "TR");
							break;
						}
					}
					if (!tRowElem) {
						//console.warn(`Found no course nr matching course ${sport}_${id}`)
						let entryElem = getErrorTable(id, `${sport}`, "Nr not found");
						updateEntryInTable(entryElem, sport, id, user); 
						continue;
					} else if (getCourseDateStr(tRowElem) != date) {
						//console.warn(`Date for course ${sport}_${id} does not match: ${date} != ${getCourseDateStr(tRowElem)}`)
						// If course with same number lies in the future, remove that course as it expired
						if (getCourseDate(tRowElem) > dateFromDDMMYY(date)) {
							console.log(`Course ${id} (${sport}) expired as a course with the same nr`+
								` and a higher date exists, removing the course...`);
							if (removeIdFromChoice(choice, sport, user, id)) {
								upload(CHOICE_FILE, choice)
								.then (() => removeBookingState(id));
							}
						} else { 
							let entryElem = getErrorTable(id, `${sport}`, "Wrong date");
							updateEntryInTable(entryElem, sport, id, user); 
						}
						continue;
					}	
//					console.log(`Found date matching course ${sport}_${id}: date ${date} == ${getCourseDateStr(tRowElem)}`)

					// create empty entry of table and insert course data
					let entryElem = createEmptyCourseTable(); 
					let bodyElem = entryElem.getElementsByTagName("TBODY")[0];
					bodyElem.replaceChildren(tRowElem);
					let newRowElem = bodyElem.lastChild;
					// Remove some table cells from the row
					for (let i = newRowElem.children.length-1; i >= 0; i--) {
						let cellElem = newRowElem.children[i];
						if (!cellElem.className.match("bs_sknr|bs_sbuch|bs_sdet|bs_stag|bs_szeit|bs_szr"))
							newRowElem.removeChild(cellElem);
						if (cellElem.className.match("bs_szr"))
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
			if (choice[sport]) {
				for (let user of Object.keys(choice[sport])) {
					for (let id of choice[sport][user]) {
						let entryElem = getErrorTable(id, `${sport}`, "Site load error");
						updateEntryInTable(entryElem, sport, id, user); 
					}
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
    // do not update if course state is already "booked"; Should never happen anyway, just extra safety check 
	else if (oldState == "booked" && state == "booking")
		return;
	else
		bookingState[courseID] = statestampArr; 

	// no changes necessary if state has not changed (i.e. same state + old state did not expire yet)
	if (state == oldState && !hasBookingStateExpired(oldState, oldStamp, true)) 
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
					// This path is never taken,
					// as a "booked" bookingState is only removed when the course is removed
					// In this path, the changes to the book button should be reverted.
				} 
				let tRow = tableEntry.getElementsByTagName("TD")[0].parentElement;
				colorRow(tRow, "none");
			}
			return;
		}
	}
}

async function updateUserdata(d) {
	// if userdata did not change, do nothing
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
		for (let i = 0; i < selectElem.options.length; i++) {
			if (selectElem.options[i].value == data.statusorig) {
				selectElem.selectedIndex = i;
				selectElem.dispatchEvent(new Event("change"));
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


async function setEntryArmStatus(entry) {
	let title = entry.getAttribute("title");
	let course = title.split("_")[0]; 
	if (armedCourses[course])
		Array.from(entry.getElementsByClassName("armed_tag")).forEach((e) => e.removeAttribute("hidden"));
	else
		Array.from(entry.getElementsByClassName("armed_tag")).forEach((e) => e.setAttribute("hidden", ""));

}

async function updateArm() {
	// check for expiry and remove expired titles 
	let expiredCourses = [];
	for (let c of Object.keys(armedCourses)) {
		if (hasArmedExpired(armedCourses[c]))
			expiredCourses.push(c)	
	}
	expiredCourses.forEach((c) => delete armedCourses[c]);

	// Display/hide the armed tag for each course 
	for (let child of choiceElem.children)
		setEntryArmStatus(child);


	let numArmedTitles = Object.keys(armedCourses).length;  
	// set arm Button and text according to whether all are armed or not
	armed_all = (numArmedTitles == Object.keys(choice).length) ? true : false;
	armed_one = (numArmedTitles > 0) ? true : false;
	if (armed_all) {
		armText.innerText = "Unarm all";
		let style = armButton.getAttribute("style").replace("green", "blue");
		armButton.setAttribute("style", style); 
	}
	else //if (armed_one)
	{
		armText.innerText = "Arm all";
		let style = armButton.getAttribute("style").replace("blue", "green");
		armButton.setAttribute("style", style); 
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
		.then (() => removeBookingState(id));
    } else {
		console.error("Could not remove course " + nr + ": Not found in choice!");
	}
    return false;
}


function onOptionChange(change) {
	let triggerElem = change["target"];
	// enforce constraints
	if (triggerElem === inputFill && triggerElem.checked == false)
		inputSubImm.checked = false;
	else if (triggerElem === inputSubImm && triggerElem.checked)
		inputFill.checked = true;

	// For simplicity, simply upload all options if one changes
	// As all options are uploaded as one single object, this does not affect performance too much 
	let optionObj = {};
	for (let inputElem of optionElem.getElementsByTagName("INPUT")) {
		if (inputElem.closest(".bs_form_row").getAttribute("hidden") != null)
			continue;
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
	setAllOptions(optionObj);
}

async function loadOptions(allowCache=true) {
	for (let inputElem of optionElem.getElementsByTagName("INPUT")) {
		if (inputElem.closest(".bs_form_row").getAttribute("hidden") != null)
			continue;
		if (inputElem.type == "radio") {
			inputElem.checked = await getOption(inputElem.name, allowCache) == inputElem.value;
		} else if (inputElem.type == "checkbox") {
			inputElem.checked = await getOption(inputElem.name, allowCache);
		} else {
			inputElem.value = await getOption(inputElem.name, allowCache);
		}
	}
	// Enforce constraints
	if (inputFill.checked == false && inputSubImm.checked) {
		console.error("INCONSISTENT OPTIONS: fillform unchecked but submitimmediately checked");
		inputSubImm.checked = false;
		onOptionChange({});
	}
}

function armAll() {
	armed_all = true;
	armed_one = true;
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
	armed_all = false;
	armed_one = false;
	let user = Object.keys(userdata)[0];
	let courselist = [];
	for (let sport of Object.keys(choice)) {
		if (choice[sport][user])
			courselist.push(sport);
	}
    return storeAsUnarmedCourses(courselist); 
}

function onArmAll() {
    if (!armed_all) 
		return confirm("Arm all courses?") && armAll();  
    else 
		return unarmAll();
}

async function onOpenAll(closeAfter=false) {
	let user = Object.keys(userdata)[0];
	let urls = [];

	for (let sport of Object.keys(choice)) {
		// get all tabs and do not reopen the ones already open
		if (choice[sport][user]) {
			let href = getHref(sport);
			// create url with anchor to first course nr appended
			let nrs = [];
			choice[sport][user].forEach((id) => nrs.push(id.split("_")[0]));
			urls.push(href + "#K" + Math.min(...nrs));
		}
	}
	await createTabsIfNotExist(urls);
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
			loadOptions(false);
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
	await updateUserdata(storageContent[USERS_FILE]);

	// get armed and bookstate files and remove expired ones 
	for (let file of Object.keys(storageContent)) {
		if (file.startsWith(ARMED_FILE)) {
			let stamp = storageContent[file];
			if (hasArmedExpired(stamp))
				remove(file);
			else 
				armedCourses[file.substring(ARMED_FILE.length)] = stamp;
		} else if (file.startsWith(BOOKSTATE_FILE)) {
			let statestamp = storageContent[file];
			let courseID = file.split("-").pop();
			let [state, stamp] = statestamp ?? [undefined, 0];
			if (hasBookingStateExpired(state, stamp))
				remove(file);
			else
				updateBooked(courseID, statestamp);
		}
	}

	// load and clean up the choice data
	choice = storageContent[CHOICE_FILE] ?? {}; 
	await cleanupChoice(default_expiry_msec);
	await updateChoice(choice, true);

	await updateArm();

	addStorageListener((changes) => {
		//console.log("[Storage Listener] Change:")
		//console.log(changes);
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
				let courseID = item.split("-").pop();
				updateBooked(courseID, changes[item].newValue);
			} else if (item == OPTIONS_FILE) {
				loadOptions(false);
			}
		}
	});

	// update course links 
	requestHTML("GET", "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/")
	.then((doc) => {
			let newCourselinks = {}
			let rootElems = doc.getElementsByClassName("bs_menu");
			for (let rootElem of rootElems) {
				for (let elem of rootElem.getElementsByTagName("A"))
					newCourselinks[elem.innerText] = elem.href.split('/').pop(); 
			}
			// Update course links if they differ from the stored course links 
			if (!objectsEqualFlat(newCourselinks, courselinks)) {
				courselinks = newCourselinks;
				upload(COURSELINKS_FILE, courselinks);
				//console.log("Fetched new course links:");
				//console.log(courselinks);
			}
			// Check start date on top of page and remove old courses
			let title = doc.getElementById("bs_top").innerText; 
			let dateStr = title.match(/\d+\.\d+\.\d+/)[0];
			let date = dateFromDDMMYY(dateStr);
			// Remove all courses that are older than date; one week as safety margin
			let expiry_ms = Date.now() - date + 7*24*60*60*1000;
			//console.log("Removing all courses that started before " + dateStr + "...");
			cleanupChoice(expiry_ms);
		})
	.catch((err) => {
		console.error("Failed to update course links: Loading course site failed");
	});	

}


loadInitialData();

// Create function that periodically checks whether a booking state or armed course has expired
setInterval(() => {
	for (let id of Object.keys(bookingState)) {
		let [state, stamp] = bookingState[id];
		if (hasBookingStateExpired(state, stamp, true)) {
			updateBooked(id, null);
		}
	}
	for (let course of Object.keys(armedCourses)) {
		if (hasArmedExpired(armedCourses[course])) {
			delete armedCourses[course];	
			updateArm();
		}
	}
}, 500);

toggleAdviceButton.addEventListener("click", () => {
	if (adviceElem.getAttribute("hidden") != null) {
		adviceElem.removeAttribute("hidden");
		toggleAdviceButton.innerText = "Hide advice";
	} else {
		adviceElem.setAttribute("hidden", "");
		toggleAdviceButton.innerText = "Show advice";
	}
})

document.getElementById("titlelink").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));
document.getElementById("openchoicesite").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));
