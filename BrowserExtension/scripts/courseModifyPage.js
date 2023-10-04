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
		<div class="darkred" style="margin-top: 0px; height: 100%;">\
			<div class="bs_form_sp2" style="float:left;margin-left:7%;margin-top:-0.1%;font-size:120%;font-weight:bolder;width:40%;height:100%">\
				<select style="color:black;" class="bs_form_field bs_fval_req" name="users" size="0" id="userselect">\
					<option value="" selected="selected" style="background-color: white;font-weight:bold;margin:20px">\
						Select User to add a course for</option>\
					<option value="" style="background-color: gray" title="adder">Add new user</option>\
				</select>\
			</div>\
			<div style="float:right;margin-right:7%;width:45%;margin-top:-0.1%">\
				<div class="status" id="statustext" style="background-color:white;">STATUS</div>\
			</div>\
		</div>\
	</div>\
';
document.getElementsByTagName('body')[0].innerHTML += topbar_html;

const bottombar = document.createElement("DIV");
bottombar.id = "hint";
bottombar.className = "bottombar"; 
document.getElementsByTagName('body')[0].appendChild(bottombar);
bottombar.innerHTML = "TEST BOTTOM"