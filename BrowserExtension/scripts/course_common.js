
const statusElem = document.getElementById("statustext");
const userSelectElem = document.getElementById("userselect"); 
const armButton = document.getElementById("armbutton"); 
const armText =  document.getElementById("armbuttontext");
let refreshSelectElem = document.getElementById("refreshselect");
const hintElem = document.getElementById("hint");

// store current url without anchor 
const currentUrl = window.location.href.split('#')[0];


let statusId = 0;
function setStatus(status, color="white") {
    statusId += 1;
    statusElem.setAttribute("style", `font-weight:bold;background-color:${color};`);
    statusElem.replaceChildren();
    if (!status) { // If status is empty, use a space as placeholder
        statusElem.innerHTML = "&nbsp;";
    } else {
        // split status into lines or use placeholder if no status
        let lines = status.split("\n");
        for (let i = 0; i < lines.length; i++) {
            let span = document.createElement("SPAN");
            span.innerText = lines[i];
            statusElem.appendChild(span);
            if (i < lines.length-1) 
                statusElem.appendChild(document.createElement("BR"));
        }
    }
}

function setStatusTemp(status, color, timeMS=1500, setInert=false) {
    setStatus(status, color);
    if (setInert) {
        armButton.setAttribute("inert", "");
    }
    const currentId = statusId;
    return new Promise((resolve) => setTimeout(() => {
        if (setInert) {
            armButton.removeAttribute("inert");
        }
        // set status to empty if it was not changed in between
        if (statusId == currentId) {
            setStatus("");
        }
        resolve();
    }, timeMS));
}
