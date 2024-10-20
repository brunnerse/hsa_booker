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
let active_courses = [];
let armed_all = false;
let armed_one = false;
let armedCourses = {};
let bookingState = {};

let courselinks = {};


const SORT_KEYS = {date: 'd', name: 'n', id: 'i'};
let sortkey = SORT_KEYS.name; 


function getHref(course) {
	let link = courselinks[course];
	// if link not registered, create it according to heuristic 
	if (!link)
		link = "_" +
			course.replaceAll(/[\s\.\/`,]/g, "_").replaceAll("&", "_und_")
			.replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss") +
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
	for (let course of Object.keys(choice)) {
		for (let user of Object.keys(choice[course])) {
			for (let idx = choice[course][user].length-1; idx >= 0; idx--) {
				let id = choice[course][user][idx];
				let [nr, dateStr] = id.split("_");
				let date = dateFromDDMMYY(dateStr); 
				// if start date is too long ago, remove the course from choice 
				if (Date.now() - date > expiry_msec) {
					console.log(`Removing course Nr. ${nr} (${course}, started at ${dateStr}) as it is in the past.`)
					changed = true;
					removeIdFromChoice(choice, course, user, id)
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
    	let [course, nr, date, user] = title.split("_");
		let entryId = nr+"_"+date;

		found = false;
		if (choice[course] && choice[course][user]) {
			for (let id of choice[course][user])
				if (id == entryId) {
					found = true;
					break;
				}
		}
		if (!found)
			choiceElem.removeChild(choiceElem.children[i]);
	}
}


function findIndexInChoice(course, nr, date, isBooked, maxIdx=null) {
	// Find correct position: Sort by course and nr, booked courses first 
	let nr_int = parseInt(nr);
	let date_int = dateFromDDMMYY(date).getTime();
	let i;
	maxIdx = maxIdx ?? choiceElem.children.length-1;
	for (i = 0; i <= maxIdx; i++) {
		let [compCourse, compNr, compDate, __] = 
			choiceElem.children[i].getAttribute("title").split("_");
		let compIsBooked = (bookingState[compNr+"_"+compDate] ?? [null])[0] == "booked";
		if (isBooked && !compIsBooked)
			break;
		else if (!isBooked && compIsBooked)
			continue; 
		else {
			if (sortkey == SORT_KEYS.id) {
				if (parseInt(compNr) > parseInt(nr)) // Nr is assumed unique, so no second check required
					break; 
			} else if (sortkey == SORT_KEYS.date) {
				let compDate_int = dateFromDDMMYY(compDate).getTime();
				if (compDate_int > date_int || (compDate_int == date_int && compCourse > course)
					|| (compDate_int == date_int && compCourse == course && parseInt(compNr) > nr_int))
					break; 
			} else { // SORT_KEYS.name
				if (compCourse > course || (compCourse == course && parseInt(compNr) > nr_int))
					break; 
			}
		}
	}
	return i;
}

function sortEntriesInTable() {
	// Takes i-th element and sort into the first 0:i elements 
	// Start with second element
	for (let i = 1; i < choiceElem.children.length; i++) {
		let [course, nr, date, __] = choiceElem.children[i].getAttribute("title").split("_");
		let id = [nr, date].join("_");
		let isEntryBooked = bookingState[id] ? true : false; 
		let idx = findIndexInChoice(course, nr, date, isEntryBooked, i);

		// Move child from i to idx via insertBefore()
		if (idx != i)
			choiceElem.insertBefore(choiceElem.children[i], choiceElem.children[idx]);
	}
}

async function updateEntryInTable(entryElem, course, id, user) {
	const title = `${course}_${id}_${user}`;
	const [nr, date] = id.split("_");

	// check if entry is already in table
	let replaceEntry;
	for (let tableEntry of choiceElem.children) {
		if (tableEntry.getAttribute("title") == title) {
			replaceEntry = tableEntry;
			break;
		}
	}
	if (!replaceEntry) {
		let isEntryBooked = (bookingState[id] ?? [null])[0] == "booked";
		let idx = findIndexInChoice(course, nr, date, isEntryBooked);
		choiceElem.insertBefore(entryElem.cloneNode(true), choiceElem.children[idx]);
		replaceEntry = choiceElem.children[idx]; 
		replaceEntry.setAttribute("title", title);
	}
	// replace the replaceEntry tableRow with entryElem
	replaceEntry.replaceChildren(...entryElem.children);
	// set close button listener
	let closeButton = replaceEntry.getElementsByClassName("closebutton")[0];
	closeButton.addEventListener("click", onCloseButton);

	// set sort listeners
	for (let sortHeaderElem of replaceEntry.getElementsByClassName("sortby"))
		sortHeaderElem.addEventListener("click", onSortBy);


	// Create href to course in the row if entry is not already a link or in error state
	let newRowElem = replaceEntry.getElementsByTagName("TR")[1];
	if (!newRowElem.className.match("\b(link|err)\b")) {
		newRowElem.classList.add("link");
		newRowElem.addEventListener("click", 
			() => createTabIfNotExists(getHref(course)+"#K"+nr, true)
			.then(window.close)
		);
	}
	// Set course active_tag 
	if (active_courses.includes(course)) {
		for (let tagElem of replaceEntry.getElementsByClassName("active_tag"))
			tagElem.removeAttribute("hidden");
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
	for (let course of Object.keys(choice)) {
		if (initElems) {
			for (let user of Object.keys(choice[course])) {
				for (let id of choice[course][user]) {
					let title = `${course}`;
					let entryElem = getErrorTable(id, title, "Loading...");
					updateEntryInTable(entryElem, course, id, user);
				}
			}
		}
		requestHTML("GET", getHref(course))
		.then((courseDoc) => {
			for (let user of Object.keys(choice[course])) {
				for (let id of choice[course][user]) {
					let [nr, date] = id.split("_");
					// find corresponding row element matching nr
					let tRowElem = null; 
					for (let nrElem of courseDoc.getElementsByClassName("bs_sknr")) {
						if (nrElem.innerText == nr) {
							tRowElem = nrElem.closest("tr");
							console.assert(tRowElem);
							break;
						}
					}
					if (!tRowElem) {
						//console.warn(`Found no course nr matching course ${course}_${id}`)
						let entryElem = getErrorTable(id, `${course}`, "Nr not found");
						updateEntryInTable(entryElem, course, id, user); 
						continue;
					} else if (getCourseDateStr(tRowElem) != date) {
						//console.warn(`Date for course ${course}_${id} does not match: ${date} != ${getCourseDateStr(tRowElem)}`)
						// If course with same number lies in the future, remove that course as it expired
						if (getCourseDate(tRowElem) > dateFromDDMMYY(date)) {
							console.log(`Course ${id} (${course}) expired as a course with the same nr`+
								` and a higher date exists, removing the course...`);
							if (removeIdFromChoice(choice, course, user, id)) {
								upload(CHOICE_FILE, choice)
								.then (() => removeBookingState(id));
							}
						} else { 
							let entryElem = getErrorTable(id, `${course}`, "Wrong date");
							updateEntryInTable(entryElem, course, id, user); 
						}
						continue;
					}	
//					console.log(`Found date matching course ${course}_${id}: date ${date} == ${getCourseDateStr(tRowElem)}`)

					// create empty entry of table and insert course data
					let entryElem = createEmptyCourseTable(); 
					let bodyElem = entryElem.getElementsByTagName("TBODY")[0];
					bodyElem.replaceChildren(tRowElem);
					let newRowElem = bodyElem.lastChild;
					// Remove some table cells from the row
					for (let i = newRowElem.children.length-1; i >= 0; i--) {
						let cellElem = newRowElem.children[i];
						if (!cellElem.className.match(/\b(bs_sknr|bs_sbuch|bs_sdet|bs_stag|bs_szeit|bs_szr)\b/))
							newRowElem.removeChild(cellElem);
					}
					// Remove time links
					for (let timeAnchorElem of newRowElem.querySelectorAll(".bs_szr a"))
							timeAnchorElem.removeAttribute("href");
					// Append course to details cell (i.e. bs_sdet)
					for (let detElem of newRowElem.getElementsByClassName("bs_sdet"))
						detElem.innerText = course + " - " + detElem.innerText; // + " (" + user + ")";

					updateEntryInTable(entryElem, course, id, user); 
				}
			}
		})
		.catch((err) => {
			if (choice[course]) {
				for (let user of Object.keys(choice[course])) {
					for (let id of choice[course][user]) {
						let entryElem = getErrorTable(id, `${course}`, "Site load error");
						updateEntryInTable(entryElem, course, id, user); 
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
		let [course, nr, date, user] = tableEntry.getAttribute("title").split("_"); 
		let id = nr+"_"+date;

		if (id == courseID) {
			if (state) {  // if state is not undefined, update it
				updateEntryInTable(tableEntry, course, id, user);
			} else if (oldState) { // entry's booking state was removed
				if (oldState == "booked") {
					// This path is never taken,
					// as a "booked" bookingState is only removed when the course is removed
					// In this path, the changes to the book button should be reverted.
				} 
				let tRow = tableEntry.querySelector("td").parentElement;
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
	if (armed_one) {
		armText.innerText = "Unarm all";
		let style = armButton.getAttribute("style").replace("green", "blue");
		armButton.setAttribute("style", style); 
	}
	else
	{
		armText.innerText = "Arm all";
		let style = armButton.getAttribute("style").replace("blue", "green");
		armButton.setAttribute("style", style); 
	}
}


async function armAll() {
	armed_all = true;
	armed_one = true;
	let user = Object.keys(userdata)[0];
	let courselist = [];
	// Find all courses where at least one courseID is not booked
	outer:
	for (let course of Object.keys(choice)) {
		if (!choice[course][user])
			continue;
		for (let courseID of choice[course][user])
			if ((await getBookingState(courseID)) != "booked") {
				courselist.push(course);
				continue outer;
			}
	}
	return storeAsArmedCourses(courselist)
	.then(() => openAll(courselist, false));
}


function unarmAll() {
	armed_all = false;
	armed_one = false;
    return storeAsUnarmedCourses(Object.keys(choice)); 
}



function onCloseButton(event) {
	let button = event.currentTarget;
    let parent = button.closest(".item-page");
    let title = parent.title;
    let [course, nr, date, user] = title.split("_");
	let id = nr+"_"+date;

	// update choice file if removed successfully
 	if (removeIdFromChoice(choice, course, user, id)) {
		upload(CHOICE_FILE, choice)
		.then (() => removeBookingState(id));
    } else {
		console.error("Could not remove course " + nr + ": Not found in choice!");
	}
    return false;
}


function onSortBy(event) {
	let elem = event.currentTarget;

	let prevSortkey = sortkey;
	if (elem.classList.contains("bs_sknr"))
		sortkey = SORT_KEYS.id; 
	else if (elem.classList.contains("bs_sdet")) 
		sortkey = SORT_KEYS.name; 
	else
		sortkey = SORT_KEYS.date; 
	
	if (sortkey != prevSortkey)
		sortEntriesInTable();
}


function onOptionChange(change) {
	let triggerElem = change.currentTarget;
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


function onArmAll() {
    if (!armed_one) 
		confirm("Arm all courses?") && armAll();  
    else 
		unarmAll();
}

function onOpenAll () {
	return openAll(Object.keys(choice), false);
}
async function openAll(courses, closeAfter=false) {
	let user = Object.keys(userdata)[0];
	let urls = [];

	for (let course of courses) {
		// get all tabs and do not reopen the ones already open
		if (choice[course][user]) {
			let href = getHref(course);
			// create url with anchor to first course nr appended
			let nrs = [];
			choice[course][user].forEach((id) => nrs.push(id.split("_")[0]));
			urls.push(href + "#K" + Math.min(...nrs));
		}
	}
	await createTabsIfNotExist(urls);
	if (closeAfter)
		window.close();
}



/*
* Initial functions
*/
async function loadOptions(allowCache=true) {
	for (let inputElem of optionElem.getElementsByTagName("INPUT")) {
		if (inputElem.closest(".bs_form_row").getAttribute("hidden") != null) // Skip hidden option elements
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

	// Find and set active_course
	await new Promise( (resolve) => { 
		base.tabs.query({ url: "*://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_*", active: true},
			(tabs) => {
				for (let tab of tabs) {
					let tabUrl = tab.url.split("#")[0];
					for (let course of Object.keys(choice)) {
						if (getHref(course) == tabUrl) {
							active_courses.push(course);
							break;
						}
					}
				}
				resolve();
			}
		);
	});

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

document.getElementById("armall").addEventListener("click", onArmAll);
document.getElementById("openall").addEventListener("click", onOpenAll);
document.getElementById("titlelink").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));
document.getElementById("openchoicesite").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));


loadOptions();
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
	if (adviceElem.hidden) {
		adviceElem.hidden = false;
		toggleAdviceButton.innerText = "Hide advice";
	} else {
		adviceElem.hidden = true;
		toggleAdviceButton.innerText = "Show advice";
	}
})

