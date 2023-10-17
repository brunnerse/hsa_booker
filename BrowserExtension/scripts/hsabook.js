const inputSubImm = document.getElementById("submitimmediately");

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


for (let inputElem of document.getElementsByTagName("INPUT")) {
	inputElem.addEventListener("change", onOptionChange);
}


document.getElementById("go-to-options").addEventListener("click", () => {
    console.log("Click event!");
    window.open("hsabook_options.html");
})
document.getElementById("go-to-options").onClick = () => {
  window.open("hsabook_options.html");
  return;
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('hsabook_options.html'));
    window.open("hsabook_options.html");
  }
};

loadOptions();