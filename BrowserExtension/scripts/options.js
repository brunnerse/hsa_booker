const inputSubImm = document.getElementById("submitimmediately");
const inputFill = document.getElementById("fillform");
const storedDataElem = document.getElementById("storeduserdata");
const toggleAdviceButton = document.getElementById("toggleadvice");
const adviceElem = document.getElementById("advice");
const optionElem = document.getElementById("configuration");

let userdata = {};

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

loadOptions();

// Load local storage and clean it up
async function loadInitialData() {
	let storageContent = await downloadAll();
	console.log(storageContent);

	courselinks = storageContent[COURSELINKS_FILE] ?? {};
	updateUserdata(storageContent[USERS_FILE]);


	// get armed and bookstate files and remove expired ones 
	for (let file of Object.keys(storageContent)) {
		if (file.startsWith(ARMED_FILE)) {
			let stamp = storageContent[file];
			if (hasExpired(stamp, armed_expiry_msec))
				remove(file);
		} else if (file.startsWith(BOOKSTATE_FILE)) {
			let statestamp = storageContent[file];
			let [state, stamp] = statestamp ?? [undefined, 0];
			if (hasExpired(stamp, default_expiry_msec) || 
					 (state == "booking" && hasExpired(stamp, booking_expiry_msec)))
				remove(file);
		}
	}

	addStorageListener((changes) => {
		//console.log("[Storage Listener] Change:")
		//console.log(changes);
		for (let item of Object.keys(changes)) {
			if (item == USERS_FILE) {
				updateUserdata(changes[USERS_FILE].newValue);
			} // TODO OPTIONS_FILE
		}
	});
}

loadInitialData();

toggleAdviceButton.addEventListener("click", () => {
	if (adviceElem.getAttribute("hidden") != null) {
		adviceElem.removeAttribute("hidden");
		toggleAdviceButton.innerText = "Hide advice";
	} else {
		adviceElem.setAttribute("hidden", "");
		toggleAdviceButton.innerText = "Show advice";
	}
})