// insert custom css
var cssId = 'custom_bars'; 
if (!document.getElementById(cssId))
{
    var head  = document.getElementsByTagName('head')[0];
    var link  = document.createElement('link');
    link.id   = cssId;
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('styles/custom_bars.css');
    link.media = 'all';
    head.appendChild(link);
}

// insert top bar
document.getElementsByTagName("BODY")[0].innerHTML += '\
	<div id="topbar" class="bar">\
		<div class="darkred" align="center" style="margin-top:0px;height:max-content">\
			<div align="center" style="float:left;margin-left:5%;font-size:120%;font-weight:bolder;">\
			Book for user:\
			</div>\
			<div align="center" style="float:left;margin-left:1%;transform:translateY(-3px);">\
				<select style="text-align:center;color:black;background-color:white;height:30px;padding: 0px; border-radius: 5px;border: 1px solid black;font-weight:bolder;font-size:120%;"\
				 name="users" size="0" id="userselect">\
					<option value="" style="background-color: gray" title="adder">Add user</option>\
				</select>\
			</div>\
			<div hidden align="center" style="float:left;margin-left:7%;font-size:120%;font-weight:bolder;width:20%">\
				<div id="armbuttontext" style="float:left;width:50%;text-align:right;padding-right:5%">ARM</div>\
				<button class="roundbutton" style="background-color:green;float:left;" id="armbutton" ></button>\
			</div>\
			<div align="center" style="overflow:hidden;float:none;margin-right:5%;padding-left:5%">\
				<div class="status" id="statustext" style="background-color:white;">&nbsp;</div>\
			</div>\
		</div>\
	</div>\
	<div class="bottombar"></div>\
	<div class="bottombar">\
		<div id="hint" class="hint">\
		</div>\
	</div>\
';

let thElem = document.createElement("TH");
thElem.style = "text-align:center;";
thElem.innerText = "Aktion";
let tHeadElems = document.getElementsByTagName("THEAD");
for (let tHead of tHeadElems) {
	let tRows = tHead.getElementsByTagName("TR");
	for (let tRow of tRows)
		tRow.appendChild(thElem.cloneNode(true));
}


let tBodyElems = document.getElementsByTagName("TBODY");
let tdElem = document.createElement("TD");
tdElem.className = "aktion";
for (let tBody of tBodyElems) {
	let tRows = tBody.getElementsByTagName("TR");
	for (let tRow of tRows)
		tRow.appendChild(tdElem.cloneNode(true));
}