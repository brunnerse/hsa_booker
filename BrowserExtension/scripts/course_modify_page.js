// insert custom css
if (!document.getElementById("custom_bars"))
{
    let link  = document.createElement('link');
    link.id   = 'custom_bars';
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('styles/custom_bars.css');
    link.media = 'all';
    let head = document.querySelector('head');
    head.appendChild(link);
}

// insert top bar
let topBar = document.createElement("div");
topBar.id = "topbar";
topBar.innerHTML = '\
		<div class="darkred" align="center" style="margin-top:0px;height:max-content">\
			<div align="center" style="float:left;margin-left:3%;font-size:120%;font-weight:bolder;">\
			User:\
			</div>\
			<div align="center" style="float:left;margin-left:1%;transform:translateY(-3px);">\
				<select style="text-align:center;color:black;background-color:white;height:30px;\
					padding: 0px; border-radius: 5px;border: 1px solid black;font-weight:bolder;font-size:120%;"\
				 name="users" size="0" id="userselect">\
					<option value="" style="background-color:gray" title="adder">Add user</option>\
				</select>\
			</div>\
			<div hidden align="center" style="float:left;margin-left:7%;font-size:120%;font-weight:bolder;width:120px">\
				<div id="armbuttontext" style="float:left;width:70px;text-align:right;padding-right:5%">ARM</div>\
				<button class="roundbutton" style="background-color:green;float:left;" id="armbutton" ></button>\
			</div>\
			<div hidden align="center" style="float:left;margin-left:10px;margin-bottom:-10px;margin-right:-30px;transform:translateY(-10px);" id="refresh">\
				<div style="margin-left:0%;font-weight:bolder;margin-bottom:2px;">Refresh:</div>\
				<select style="text-align:center;padding:0px; margin:0px; border-radius:5px; border:2px solid black;\
							 font-weight:bolder;color:black;background-color:white"\
				 name="refresh" size="1" id="refreshselect">\
					<option selected value="auto" style="background-color:white">Auto</option>\
					<option value="1" style="background-color:white">1 second</option>\
					<option value="2"> 2 seconds</option>\
					<option value="5" style="background-color: white"> 5 seconds</option>\
					<option value="10" style="background-color: white">10 seconds</option>\
					<option value="30" style="background-color: white">30 seconds</option>\
				</select>\
			</div>\
			<div align="center" style="overflow:hidden;padding-right:3%;padding-left:5%;min-width:350px;">\
				<div class="status" id="statustext" style="background-color:white;">&nbsp;</div>\
			</div>\
		</div>\
';

let bottomBar = document.createElement("div");
bottomBar.id = "bottombar";
bottomBar.innerHTML = '\
		<div id="hint"></div>\
';

let b = document.createElement("div");
b.setAttribute("style", "height:65px;background-color:black");

// insert topbar and bottombar at the start and end of body
let body = document.querySelector("body");
body.insertBefore(topBar, body.children[0]);
body.insertBefore(b, body.children[0]);
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

