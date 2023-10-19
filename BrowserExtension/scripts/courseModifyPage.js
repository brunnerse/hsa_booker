console.log("COURSE SCRIPT ACTIVE");

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
const topbar_html = '<div id="topbar" class="bar">\
		<div class="darkred" align="center" style="margin-top:0px;height:max-content">\
			<div align="center" style="float:left;margin-left:5%;font-size:120%;font-weight:bolder;">\
			Book for user:\
			</div>\
			<div align="center" style="float:left;margin-left:2%;font-size:120%;font-weight:bolder;">\
				<select style="color:black;" class="bs_form_field bs_fval_req" name="users" size="0" id="userselect">\
					<option value="" style="background-color: gray" title="adder">Add user</option>\
				</select>\
			</div>\
			<div align="center" style="float:left;margin-left:7%;font-size:120%;font-weight:bolder;width:20%">\
				<div id="armbuttontext" style="float:left;width:50%;text-align:right;padding-right:5%">ARM</div>\
				<button class="roundbutton" style="background-color:green;float:left;" id="armbutton" ></button>\
			</div>\
			<div align="center" style="overflow:hidden;float:none;margin-right:5%;">\
				<div class="status" id="statustext" style="background-color:white;">STATUS</div>\
			</div>\
		</div>\
	</div>\
';
const bottombar_html = '<div class="bottombar">\
		<div id="hint" class="hint"">\
		</div>\
	</div>\
';
document.getElementsByTagName('body')[0].innerHTML += 
	topbar_html 
	+ bottombar_html 
	+ '<div class="bottombar" style="position:static"></div>';


let tHeadElems = document.getElementsByTagName("THEAD");
for (let tHead of tHeadElems) {
	let tRows = tHead.getElementsByTagName("TR");
	for (let tRow of tRows)
		tRow.innerHTML += '<th style="text-align:center">Aktion</th>'
}
let tBodyElems = document.getElementsByTagName("TBODY");
for (let tBody of tBodyElems) {
	let tRows = tBody.getElementsByTagName("TR");
	for (let tRow of tRows)
		tRow.innerHTML += '<td class="aktion bs_sbuch" style="text-align:center"></td>'
}
