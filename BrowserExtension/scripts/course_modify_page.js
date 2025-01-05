// insert custom css
let link  = document.createElement('link');
link.href = chrome.runtime.getURL('styles/custom_bars.css');
link.rel  = 'stylesheet';
link.type = 'text/css';
link.id   = 'custom_bars';
let head = document.querySelector('head');
head.appendChild(link);

// insert top bar
let topBar = document.createElement("div");
topBar.id = "topbar";
topBar.innerHTML = '\
		<div align="center">\
			<div align="center" class="bigboldfont" style="margin-left:3%;">User:</div>\
			<div align="center" style="margin-left:1%; transform:translateY(-3px);">\
				<select id="userselect" name="users" size="0">\
					<option value="" style="background-color:gray" title="adder">Add user</option>\
				</select>\
			</div>\
			<div hidden align="center" class="bigboldfont" style="margin-left:7%; width:120px">\
				<div id="armbuttontext" style="width:70px; padding-right:5%; text-align:right">ARM</div>\
				<button id="armbutton" class="roundbutton" style="background-color:green;"></button>\
			</div>\
			<div id="refresh" hidden align="center">\
				<div>Refresh:</div>\
				<select id="refreshselect" name="refresh" size="1">\
					<option selected value="auto">Auto</option>\
					<option value="1">1 second</option>\
					<option value="2"> 2 seconds</option>\
					<option value="5"> 5 seconds</option>\
					<option value="10">10 seconds</option>\
					<option value="30">30 seconds</option>\
				</select>\
			</div>\
			<div align="center" style="padding-right:3%; padding-left:5%; min-width:350px;">\
				<div id="statustext" style="background-color:white;">&nbsp;</div>\
			</div>\
		</div>\
';

let bottomBar = document.createElement("div");
bottomBar.id = "bottombar";
bottomBar.innerHTML = '\
		<div id="hint"></div>\
';


// insert topbar and bottombar at the start and end of body
let body = document.querySelector("body");
body.insertBefore(topBar, body.children[0]);
body.appendChild(bottomBar);


// Create table header and cell element for aktion button
let thElem = document.createElement("th");
thElem.style = "text-align:center;";
thElem.innerText = "Aktion";

let tdElem = document.createElement("td");
tdElem.classList.add("aktion");

let button = document.createElement("button");
button.classList.add("aktionbutton");
button.type = "button";
tdElem.appendChild(button);

// Append new column to all table headers and table rows 
document.querySelectorAll("thead tr").forEach((tRow) => tRow.appendChild(thElem.cloneNode(true)));
document.querySelectorAll("tbody tr").forEach((tRow) => tRow.appendChild(tdElem.cloneNode(true)));

