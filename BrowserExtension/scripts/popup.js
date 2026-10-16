
const inputSubImm = document.getElementById("submitimmediately");
const inputFill = document.getElementById("fillform");
const armButton = document.getElementById("armallbutton"); 
const armText = document.getElementById("armbuttontext");
const storedDataElem = document.getElementById("storeduserdata");
const choiceElem = document.getElementById("choice");
const toggleAdviceButton = document.getElementById("toggleadvice");
const adviceElem = document.getElementById("advice");
const optionElem = document.getElementById("configuration");
const emptyTableElem = document.getElementById("template_table_entry");
const activeTagElem = document.getElementById("template_active_tag");

let userdata = {};
let choice = {};
let active_courses_hrefs = [];
let armed_all = false;
let armed_one = false;
let armedCourses = {};
let bookingState = {};

let courselinks = {};

const SORT_KEYS = {date: 'd', weekday : 'w', alphabetical: 'a', nr: 'n'};
let sortkey = SORT_KEYS.alphabetical; 


function getHref(course, short=false) {
	let link = courselinks[course];
	// if link not registered, create it according to heuristic 
	if (!link)
		link = "_" +
			course.replaceAll(/[\s\.\/``,]/g, "_").replaceAll("&", "_und_").replaceAll("ß", "ss").
				   replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue") + ".html";
	return short ? link : "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/" + link; 
}


function createCourseTable(courseID, details, msg, error=false) {
	const elem = emptyTableElem.cloneNode(true);
	elem.removeAttribute("id");
	elem.removeAttribute("hidden");
	let [nr, date] = courseID.split("_");
	elem.querySelector("tbody .bs_sknr").innerText = nr;
	elem.querySelector("tbody .bs_sdet").innerText = details;
	elem.querySelector("tbody .bs_szr").innerText = date; 
	elem.querySelector("tbody .bs_sbuch *").value = msg;

	if (error)
		elem.querySelector("table>tbody>tr").classList.add("err");

	return elem;
}



// remove expired courses from choice and upload it 
async function cleanupChoice(expiry_msec) {
	for (let course of Object.keys(choice)) {
		for (let user of Object.keys(choice[course])) {
			for (let idx = choice[course][user].length-1; idx >= 0; idx--) {

				let courseID = choice[course][user][idx];
				let [nr, dateStr] = getNrAndDateFromCourseID(courseID); 
				let date = dateFromDDMMYY(dateStr); 

				// if start date is too long ago, remove the course from choice 
				if (Date.now() - date > expiry_msec) {
					console.log(`Removing course Nr. ${nr} (${course}, started on ${dateStr}) as it is in the past.`);
					removeCourseID(courseID, course, user, choice);
				} 
			}
		}
	}
}

function removeObsoleteChoiceEntries() {
	outer:
	for (let i = choiceElem.children.length - 1; i>= 0; i--) {
		let title = choiceElem.children[i].title;
    	let [course, elemID, user] = title.split(";");

		if (choice[course] && choice[course][user]) {
			for (let id of choice[course][user])
				if (id == elemID) {
					// Entry is in choice and therefore not obsolete; continue with next entry
					continue outer;
				}
		}
		// At this point, the entry has not been found and is therefore not in choice; remove it 
		choiceElem.children[i].remove();
	}
}



function sortCourseTableIntoChoiceElem(courseTable) {
	const PRIORITIZE_BOOKED_COURSES = false;
	// Find correct position: Sort by course and nr, booked courses first 

	let [course, id, __] = courseTable.getAttribute("title").split(";");
	let [nr, date] = id.split("_");

	let date_int = dateFromDDMMYY(date).getTime();

	for (let compTable of choiceElem.children)
	{
		let [compCourse, compId, __] = compTable.getAttribute("title").split(";");
		
		if (PRIORITIZE_BOOKED_COURSES) {
			let isBooked = (bookingState[id] ?? [null])[0] == "booked";
			let compIsBooked = (bookingState[compId] ?? [null])[0] == "booked";
			if (isBooked && !compIsBooked) {  // If course is booked but compared course is not: Return 
				choiceElem.insertBefore(courseTable, compTable);
				return;
			}
			else if (!isBooked && compIsBooked) // If course is not booked but compared course is: Go to next index
				continue; 
		}

		let [compNr, compDate] = compId.split("_");

		switch (sortkey) {
			case SORT_KEYS.weekday:
				try {
					let weekday_time = courseTable.querySelector("tbody .bs_stzo").innerText;
					let compWeekday_time = compTable.querySelector("tbody .bs_stzo").innerText;
 
					let weekday = weekday_time.match(/\w+/).toString();
					let compWeekday = compWeekday_time.match(/\w+/).toString();

					console.log(weekday, compWeekday)
					const weekdays = ['Mo', 'Di', 'Tue', 'Mi', 'Wed', 'Do', 'Thu', 'Fr', 'Sa', 'So', 'Su'];
					if (weekdays.indexOf(weekday) < weekdays.indexOf(compWeekday) 
						|| (weekday == compWeekday && weekday_time < compWeekday_time) )  
					{
						choiceElem.insertBefore(courseTable, compTable);
						return;
					}
					else if (weekday != compWeekday) // If weekdays are equal, do not break but check date order next  
						break;
				} catch { /* Do not do anything: Fall back to date order */}

			case SORT_KEYS.date:
				let compDate_int = dateFromDDMMYY(compDate).getTime();

				console.log(`${date} (${date_int}) vs ${dateFromDDMMYY(compDate)} (${compDate_int})`)
				if (date_int < compDate_int) {
					choiceElem.insertBefore(courseTable, compTable);
					return;
				}
				else if (date_int != compDate_int) 
					break;
				// if date equal: Do not break to check the alphabetical order next
			default:
			case SORT_KEYS.alphabetical:
				if (course < compCourse) {
					choiceElem.insertBefore(courseTable, compTable);
					return;
				}
				else if (compCourse != course) 
					break;
				// if name equal: Do not break to check the nr order
			case SORT_KEYS.nr:
				// Nr is assumed unique
				// -> If numbers are equal, it must be the same element -> just call insertBefore and return
				if (parseInt(nr) <= parseInt(compNr))  {
					choiceElem.insertBefore(courseTable, compTable);
					return;
				}
				break;
		}
	}
	// Insert at the end
	choiceElem.insertBefore(courseTable, null);
}



async function updateCourseTable(newTable, course, id, user) {
	const title = `${course};${id};${user}`;

	// check if entry is already in table
	let courseTable;
	for (let choiceTable of choiceElem.children) {
		if (choiceTable.getAttribute("title") == title) {
			courseTable = choiceTable;
			break;
		}
	}

	// If no entry exists yet: create one
	if (!courseTable) {
		courseTable = createCourseTable(id, course, "")
		courseTable.setAttribute("title", title);

		// Set sort listeners
		courseTable.querySelectorAll(".sortby").forEach(
			(sElem) => sElem.addEventListener("click", onSortBy) );
		// Set close button listener
		courseTable.querySelector(".closebutton").addEventListener("click", onCloseButton);

		// Create href to course 
		let trElem = courseTable.querySelector("table.bs_kurse>tbody>tr");
		trElem.classList.add("link");
		trElem.addEventListener("click", 
			() => {
				let nr = id.split("_")[0];
				// Maybe: Only click if the row is not erroneous?
				//if (!trElem.classList.contains("err"))
					createTabIfNotExists(getHref(course)+"#K"+nr, true)
					.then(window.close);
			}
		);

		// Insert new courseTable into choiceElem
		sortCourseTableIntoChoiceElem(courseTable);
	}


	let trElem = courseTable.querySelector("table.bs_kurse>tbody>tr");
	let newTrElem = newTable.querySelector("table.bs_kurse>tbody>tr") ?? newTable;


	console.assert(newTrElem.tagName.match(/tr/i));
	// replace the replaceEntry tableRow with entryElem
	for (let tdElem of trElem.querySelectorAll("tr>td")) {
		let newTdElem = newTrElem.querySelector(`.${tdElem.className}`);
		if (newTdElem) // && tdElem.className != "bs_sbuch")
			tdElem.replaceChildren(...newTdElem.cloneNode(true).children)
	}

	// Clean up some cells in the table
	trElem.querySelectorAll(".bs_sdet .dispmobile").forEach((d) => d.remove());
	trElem.querySelectorAll(".bs_sdet div").forEach((d) => d.remove());
	trElem.querySelectorAll(".bs_sort").forEach((d) => d.remove());

	// Adapt text of some elements
	trElem.querySelectorAll(".bs_sdet").forEach((d) => {
		if (!d.innerText.includes(course))
			d.innerText = `${course} - ${d.innerText}`
	}
	);
	try {
		trElem.querySelector(".bs_stzo").innerText = 
			trElem.querySelector(".bs_stag").innerText + "\n" +
			trElem.querySelector(".bs_szeit").innerText; 
	} catch {};

	// Remove time links
	trElem.querySelectorAll(".bs_szr a").forEach((a) => a.removeAttribute("href"));

	// Set err if newTable has err
	if (newTrElem.classList.contains("err")) {
		trElem.classList.add("err");
		trElem.classList.remove("link");
	} else {
		trElem.classList.add("link");
		trElem.classList.remove("err");
	}


	// If course is among active tabs, append active_tag  
	if (active_courses_hrefs.includes(getHref(course, /*short=*/true))) {
		let child = activeTagElem.cloneNode(true);
		child.removeAttribute("id");
		child.removeAttribute("hidden");
		trElem.querySelector(".bs_sknr").appendChild(child);
	}

	// Set armed tag according to whether the course is armed
	setArmedTag(courseTable, course);

	// Set bookingState to full if course if full and bookingState is error or none
	let bookButton = trElem.querySelector("input");
    if (bookButton && ["bs_btn_ausgebucht", "bs_btn_warteliste"].includes(bookButton.className)) {
		if (!bookingState[id] /*|| bookingState[id][0] == "error"*/) {
			bookingState[id] = ["full", Infinity];
		}	
	}

	// Color entry depending on the course's booking state
	if (bookingState[id]) {
		colorRow(trElem, bookingState[id][0]);
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
}

async function updateChoice(c, showLoadingElement=false) {
	let prevChoice = choice ?? {};
	choice = c ?? {};

	if (Object.keys(choice).length == 0) {
		document.getElementById("armchoice").setAttribute("hidden", "");
		document.getElementById("openchoicesite").removeAttribute("hidden");
	}
	else {
		document.getElementById("armchoice").removeAttribute("hidden");
		document.getElementById("openchoicesite").setAttribute("hidden", "");
	}

	// First: Remove table entries not in choice anymore
	outer:
	for (let i = choiceElem.children.length - 1; i>= 0; i--) {
		let title = choiceElem.children[i].title;
    	let [course, elemID, user] = title.split(";");

		if (choice[course] && choice[course][user]) {
			for (let id of choice[course][user])
				if (id == elemID) {
					// Entry is in choice and therefore not obsolete; continue with next entry
					continue outer;
				}
		}
		// At this point, the entry has not been found and is therefore not in choice; remove it 
		choiceElem.children[i].remove();
	}

	// Then: Add/update table entries in choice
	for (let course of Object.keys(choice)) {
		// Check if course did not change from previous choice to current choice
		if (prevChoice[course] && JSON.stringify(prevChoice[course]) == JSON.stringify(choice[course])) {
			continue;
		}
		// Course must be added/updated
		if (showLoadingElement) {
			for (let user of Object.keys(choice[course])) {
				for (let courseID of choice[course][user]) {
					let table = createCourseTable(courseID, `${course}`, "Loading...", false);
					updateCourseTable(table, course, courseID, user);
				}
			}
		}
		requestHTML("GET", getHref(course))
		.then((courseDoc) => {
			for (let user of Object.keys(choice[course])) {
				for (let id of choice[course][user]) {
					let [nr, date] = getNrAndDateFromCourseID(id);
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
						let courseTable = createCourseTable(id, `${course}`, "Nr not found", true);
						updateCourseTable(courseTable, course, id, user); 
					} else if (getCourseDateStr(tRowElem) != date) {
						// If course with same number lies at least one month in the future, remove that course as it expired
						if (getCourseDate(tRowElem) > dateFromDDMMYY(date) + 1000*60*60*24*30) {
							console.log(`Course ${id} (${course}) expired as a course with the same nr`+
								` and a higher date exists, removing the course...`);
							removeCourseID(id, course, user, choice);
						} else { 
							console.warn(`Date for course ${course}_${id} does not match: ${date} != ${getCourseDateStr(tRowElem)}`)

							let courseTable = createCourseTable(id, `${course}`, "Wrong date", true);
							updateCourseTable(courseTable, course, id, user); 
						}
					} else {
						// console.log(`Found date matching course ${course}_${id}: date ${date} == ${getCourseDateStr(tRowElem)}`)
						updateCourseTable(tRowElem, course, id, user); 
					}	
				}
			}
		})
		.catch((err) => {
			console.log(`Failed to load site for course ${course}`, err);
			if (choice[course]) {
				for (let user of Object.keys(choice[course])) {
					for (let id of choice[course][user]) {
						let courseTable = getErrorTable(id, `${course}`, "Site load error");
						updateCourseTable(courseTable, course, id, user); 
					}
				}
			}	
		});
	}
}

async function updateBooked(courseID, statestampArr) {
	if (!statestampArr) {
		// State was deleted; Recheck as there might still be a local/sync state 
		statestampArr = await getBookingState(courseID, /*includeTimestamp=*/true);
		if (statestampArr && hasBookingStateExpired(...statestampArr))
			statestampArr = null;
	}

	let [oldState, oldStamp] = bookingState[courseID] ?? [undefined, 0];
	let [state, newStamp] = statestampArr ?? [undefined, 0]

	if (!statestampArr)
		delete bookingState[courseID];
    // do not update if course state is already "booked";
	else if (oldState == "booked")
		return;
	else
		bookingState[courseID] = statestampArr; 

	// no changes necessary if state has not changed (i.e. same state + old state did not expire yet)
	if (state == oldState && !hasBookingStateExpired(oldState, oldStamp, true)) 
		return;

	// find element in table and change it
	for (let tableEntry of choiceElem.children) {
		let [course, id, user] = tableEntry.getAttribute("title").split(";"); 

		if (id == courseID) {
			if (state) {  // if state is not undefined, update it
				updateCourseTable(tableEntry, course, id, user);
			} else if (oldState) { // entry's booking state was removed
				if (oldState.match(/booked|booking|error/)) {
					// Revert the changes to the book button
					let bookButton = tableEntry.querySelector("td input");
					if (bookButton) {
						let bs_btn_class = bookButton.className.match(/\bbs_btn_\w+\b/);
						if (bs_btn_class) {
							let s = bs_btn_class[0].split("_").pop();
							bookButton.value = s[0].toUpperCase() + s.slice(1);
						}
					}
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
		let inputElems = storedDataElem.getElementsByTagName("input");
		for (let inputElem of inputElems) {
			// fill form data
			if (data[inputElem["name"]] != undefined)
					inputElem.value = data[inputElem["name"]];
		}
	}
}


async function setArmedTag(entry, course) {
	if (armedCourses[course])
		entry.querySelector(".armed_tag").removeAttribute("hidden");
	else
		entry.querySelector(".armed_tag").setAttribute("hidden", "");

}

async function updateArm(course, timestamp) {
	// check for expiry and remove expired titles 
	if (!timestamp || hasArmedExpired(timestamp))
		delete armedCourses[course];
	else 
		armedCourses[course] = timestamp;

	// Display/hide the armed tag for each course 
	for (let entry of choiceElem.children) {
		let entryCourse = entry.getAttribute("title").split(";")[0]; 
		if (entryCourse == course) 
			setArmedTag(entry, course);
	}

	let numArmedTitles = Object.keys(armedCourses).length;  
	// set arm Button and text according to whether all are armed or not
	armed_all = (numArmedTitles == Object.keys(choice).length) ? true : false;
	armed_one = (numArmedTitles > 0) ? true : false;
	if (armed_one) {
		armText.innerText = "Unarm all";
		let style = armButton.getAttribute("style").replace("green", "blue");
		armButton.setAttribute("style", style); 
	} else {
		armText.innerText = "Arm all";
		let style = armButton.getAttribute("style").replace("blue", "green");
		armButton.setAttribute("style", style); 
	}
}


async function armAll() {
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
    return storeAsUnarmedCourses(Object.keys(choice)); 
}


function onCloseButton(event) {
	let button = event.currentTarget;
    let parent = button.closest(".item-page");
    let title = parent.title;
    let [course, courseID, user] = title.split(";");

	removeCourseID(courseID, course, user, choice)
	.catch(() => console.error("Error when removing course " + nr));
}


function onSortBy(event) {
	let elem = event.currentTarget;

	let prevSortkey = sortkey;

	if (elem.classList.contains("bs_sknr"))
		sortkey = SORT_KEYS.nr; 
	else if (elem.classList.contains("bs_stzo")) 
		sortkey = SORT_KEYS.weekday; 
	else if (elem.classList.contains("bs_szr")) 
		sortkey = SORT_KEYS.date; 
	else // (elem.classList.contains("bs_sdet"))  // Default
		sortkey = SORT_KEYS.alphabetical; 
	
	if (sortkey != prevSortkey) {
		// Insertion Sort strategy: Take i-th element and sort it into the first 0:i elements 
		// sortCourseTableIntoChoiceElem() stops at the i-th element since this is an comparison to itself, which is always successflu
		for (let courseTable of choiceElem.children)
			sortCourseTableIntoChoiceElem(courseTable);
	}
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
	for (let inputElem of optionElem.getElementsByTagName("input")) {
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
	for (let inputElem of optionElem.getElementsByTagName("input")) {
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
			let course = file.substring(ARMED_FILE.length);
			if (hasArmedExpired(stamp))
				remove(file);
			else 
				updateArm(course, stamp);
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

	// Find all active tabs that have a course site open and append them to active_courses_hrefs 
	await new Promise( (resolve) => { 
		base.tabs.query({ url: "*://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/_*", active: true/*, currentWindow: true*/},
			(tabs) => {
				for (let tab of tabs) {
					active_courses_hrefs.push(tab.url.match(/_\w+\.html/)[0]);
				}
				resolve();
			}
		);
	});

	// Load the choice data
	await updateChoice(storageContent[CHOICE_FILE], true);

	addStorageListener((changes) => {
		//console.log("Storage change:", changes, Object.keys(changes)[0], changes[Object.keys(changes)[0]].newValue)
		for (let item of Object.keys(changes)) {
			if (item == USERS_FILE) {
				updateUserdata(changes[USERS_FILE].newValue);
			} else if (item.startsWith(ARMED_FILE)) {
				let course = item.substring(ARMED_FILE.length);
				updateArm(course, changes[item].newValue);
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

	// update course links and remove expired choice entries 
	requestHTML("GET", "https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/")
	.then((doc) => {
			let newCourselinks = {}
			let rootElems = doc.getElementsByClassName("bs_menu");
			for (let rootElem of rootElems) {
				for (let elem of rootElem.getElementsByTagName("a"))
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
			let semester_start_date = dateFromDDMMYY(dateStr);
			// Remove all courses that are older than semester_start_date (+1 week as safety margin)
			// Expiry_ms is how long ago the semester_start_date was; Courses that started even 
			// longer ago must have started in the previous semester and are therefore now expired 
			let expiry_ms = Date.now() - semester_start_date + 7*24*60*60*1000;
			cleanupChoice(expiry_ms);
		})
	.catch((err) => {
		cleanupChoice(default_expiry_msec);
		console.error("Failed to update course links: Loading course site failed");
	});	
}

// Add listeners
for (let inputElem of optionElem.getElementsByTagName("input")) {
	inputElem.addEventListener("change", onOptionChange);
}

document.getElementById("resetdata").addEventListener("click", () => {
	if (confirm("Reset HSA Booker extension?")) {
			base.storage.local.clear();
			base.storage.sync.clear();
			loadOptions(false);
	}
});

toggleAdviceButton.addEventListener("click", () => {
	if (adviceElem.hidden) {
		adviceElem.hidden = false;
		toggleAdviceButton.innerText = "Hide advice";
	} else {
		adviceElem.hidden = true;
		toggleAdviceButton.innerText = "Show advice";
	}
});

document.getElementById("armall").addEventListener("click", onArmAll);
document.getElementById("openall").addEventListener("click", onOpenAll);
document.getElementById("titlelink").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));
document.getElementById("openchoicesite").addEventListener("click",
	 () => window.open("https://anmeldung.sport.uni-augsburg.de/angebote/aktueller_zeitraum/"));



// Load and initialize data
loadOptions();
loadInitialData();

// Create function that periodically checks whether a booking state or armed course has expired
setInterval(() => {
	for (let courseID of Object.keys(bookingState)) {
		let [state, stamp] = bookingState[courseID];
		if (hasBookingStateExpired(state, stamp, true)) {
			updateBooked(courseID, null);
		}
	}
	for (let course of Object.keys(armedCourses)) {
		if (hasArmedExpired(armedCourses[course])) {
			updateArm(course, null);
		}
	}
}, 500);

