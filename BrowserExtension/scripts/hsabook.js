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
	for (let tableEntry of choiceElem.children) {
		if (tableEntry.getAttribute("title") == title) {
			tableEntry.outerHTML = entryElem.innerHTML;
			entryElem = tableEntry;
			break;
		}
	}
	entryElem.setAttribute("title", title);
	choiceElem.appendChild(entryElem);

	// replace tableRow with entryHTML input appended with the old status bar 
	const rowElem = entryElem.getElementsByTagName("TR")[1];
	// clear row for 100msec for visual effect of refresh
	for (let cell of rowElem.children)
		cell.setAttribute("style", "color: white;");
	await sleep(100);
	// TODO append close button and set listener
	// element.getElementsByClassName("closebutton")[0].addListener("click", () => onCloseButton(element));
	//TODO append status element
//	const statusElem = entryElem.getElementsByClassName("nr_name")[0];
//	rowElem.innerHTML = entryHTML + statusElem.outerHTML;

//	statusElements[title] = rowElem.getElementsByClassName("nr_name")[0];
//	updateEntryStateTitle(title, bookingState[title], getColorForBookingState(bookingState[title]));

}

function onCloseButton(button) {
    let parent = button.parentElement;
    while (parent.id != "bs_content") {
        parent = parent.parentElement;
    }
    let title = parent.title;
    let [sport, nr, user] = title.split("_");
    let longTitle = `${sport} - ${nr} (${user})`;

    if (choice[sport] && choice[sport][user] && choice[sport][user].includes(nr) && confirm(`Remove course ${longTitle}?`)) {
        delete bookingState[title];
        choice[sport][user].splice(choice[sport][user].indexOf(nr), 1);
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
            console.log("Trying to remove course " + nr + " from bookedcourses file...");
            return download("bookedcourses")
            .then((bookedCourses) => {
				if (bookedCourses.includes(nr)) {
					bookedTitles.splice(bookedCourses.indexOf(nr), 1);
					upload("bookedcourses", bookedTitles);
				}
            });
        });
    }
    return false;
}

async function updateChoice() {
	for (let sport of Object.keys(choice)) {
		for (let user of Object.keys(choice[sport])) {
			for (let nr of choice[sport][user]) {
				let title = `${sport}_${nr}_${user}`;
				let entryElem = getErrorTable(nr, title, "init");
				console.log("update entry")
				await updateEntryInTable(entryElem, sport, nr, user); 
			}
		}
	}
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


let refreshIntervalID;
let armed = false;

function onArmAll() {
    const armText =  document.getElementById("armbuttontext");
    armed = !armed;
    if (armed) {
        armText.innerHTML = "Unarm all marked courses";
        let style = armButton.getAttribute("style").replace("green", "blue");
        armButton.setAttribute("style", style); 
        // mark website as armed in options
        download("armedcourses")
        .then((d) => {
			// TODO add all courses
			let user = Object.keys(userdata)[0];
            let courselist = [];
			for (let sport of Object.keys(choice)) {
				if (choice[sport][user])
					courselist.push(sport);
				//TODO maybe check if not all courses booked yet for that sport
			}
			// TODO if not all courses yet: onArm();return;

			d = [];
			courselist.forEach((sport) => d.push(getHref(sport)));
            return upload("armedcourses", d).then(onOpenAll());
        })
        .then(() => { 
            // TODO automatically unarm when all courses done
			// or TODO just unarm instantly and maybe close the popup
			refreshIntervalID = setInterval(() =>  {
 				//.then(onArm);
                }, 500);
            });
    } else {
        armText.innerHTML = "Arm all marked courses";
        let style = armButton.getAttribute("style").replace("blue", "green");
        armButton.setAttribute("style", style); 
        // clear armed list 
        upload("armedcourses", []);
        // clear refreshInterval
        if (refreshIntervalID)
            clearInterval(refreshIntervalID);
    }

}

function onOpenAll() {
	download(CHOICE_FILE).then((d) => {
		choice = d ?? {};
	}).then(async ()=> {
		let currentHref = await getCurrentTabHref(); 
		let user = Object.keys(userdata)[0];
		for (let sport of Object.keys(choice)) {
			// TODO maybe get all tabs and don't reopen the ones already open
			if (choice[sport][user]) {
				let href = getHref(sport);
				if (href != currentHref)
					window.open(getHref(sport));
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

download(CHOICE_FILE).then((d) => {
	choice = d;
	updateChoice();
})