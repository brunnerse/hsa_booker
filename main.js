//const HSA_LINK = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
const HSA_LINK = "https://anmeldung.sport.uni-augsburg.de"

var choice = undefined;

var states = {};


function fun() {
    document.getElementById("demo").innerHTML = "Paragraph changed.";
}

function requestHTML(method, url) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.responseType = "document";
        xhr.onloadend = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}

async function arm() {
    console.log("Arming...");

}



async function refreshChoice() {
    console.log("Choice: " + choice);
    if (!choice) {

        loadChoice();
        return;
    }

    let courses = {}
    rootElem = document.getElementById("courses");
    console.log(rootElem.innerHTML);
    for (elem of rootElem.getElementsByTagName("A")) {
        courses[elem.innerHTML] = elem.href;
    }
    console.log("Available courses: " + Object.keys(courses));

    let text = "<div class=\"col-xs-12 content noPadRight\">";

    for (let nr of Object.keys(choice)) {
        let c = choice[nr];
        text += 
        `
        <table class="bs_kurse"><thead><tr><th class="bs_sknr">
        <span class="bslang_de">Kursnr</span>
        </th><th class="bs_sdet">
        <span class="bslang_de">Details</span>
        </th><th class="bs_stag">
        <span class="bslang_de">Tag</span></th>
        <th class="bs_szeit"><span class="bslang_de">Zeit</span></th>
        <th class="bs_sort"><span class="bslang_de">Ort</span></th>
        <th class="bs_szr"><span class="bslang_de">Zeitraum</span>
        <th class="bs_skl">
        <span class="bslang_de">Leitung</span></th>
        <th class="bs_spreis"><span class="bslang_de">Preis</span></th>
        <th class="bs_sbuch"><span class="bslang_de">Buchung</span>
        </th></tr></thead><tbody>"
        `;
        if (!courses[c]) {
            text += "<tr class=\"bs_odd\">"+c+" not found!</tr>";
            console.log("not found " + c);
        } else {
            console.log("found " + c);
            let idx = courses[c].lastIndexOf("/");
            let link = HSA_LINK + "/angebote/aktueller_zeitraum" + 
                courses[c].substr(idx);
            console.log(link);
            let doc = await requestHTML("GET","extern?url="+link);
            let nums = doc.getElementsByClassName("bs_sknr");
            let found = false;
            for (n of nums) {
                if (n.innerHTML == nr) {
                    found = true;
                    text += n.parentElement.outerHTML;

                    // get booking button
                    let bookElem = n.parentElement.getElementsByClassName("bs_sbuch")[0];
                    let bookButton = bookElem.getElementsByClassName("bs_btn_buchen");
                    if (bookButton.length > 0) {
                        states[nr] = "ready";
                    }
                    else {
                        bookButton = bookElem.getElementsByClassName("bs_btn_ausgebucht");
                        if (bookButton.length > 0) {
                            states[nr] = "full";
                        } else {
                            states[nr] = "button_gone"
                        }
                    }


                    break;
                }
            }
            if (!found) {
                text += "</br>Kurs " + c + " Kursnr." + choice[c] + " not found!</br>";
                states[c] = "error";
            }
        }
        text += "</tbody></table>"
        
    }

    text += "</div>";
    document.getElementById("choice").innerHTML = text;
    console.log(states);
}

function loadChoice() {
    let xhr = new XMLHttpRequest();
    xhr.onerror = () => {
        document.getElementById("courses").innerHTML = "failed ";
    };
    xhr.onloadend = () => {
        console.log("Loaded choice.")
        choice = xhr.response;
        console.log(choice);

        refreshChoice();
    }

    xhr.open(
    "GET","choice.json",
    );
    xhr.responseType = "json";
    xhr.send();

}

function loadCourses() {
    const xhr = new XMLHttpRequest();

    xhr.onerror = () => {
            document.getElementById("courses").innerHTML = "failed ";
        };
    xhr.onload = () => {
        console.log("Loaded [Status %d]", xhr.status);
    };
    xhr.onloadend = () => {
        console.log("Load end.");
        doc = xhr.responseXML;  
    
        courses = []
        rootElems = doc.getElementsByClassName("bs_menu");
        for (rootElem of rootElems) {
            for (elem of rootElem.getElementsByTagName("A")) {
                console.log(elem.innerHTML)
                console.log("[Link] " + elem.href)
                courses.push(elem.innerHTML);
            }
        }
         console.log("Courses: " + courses);
         document.getElementById("courses").innerHTML = 
         //"<textarea>"+courses+"</textarea>"
         "<div class=\"col-xs-12 content noPadRight\">"+
         doc.getElementsByClassName("item-page")[0].innerHTML
         +"</div>"
         ;
    }

    xhr.open(
      "GET",
      "extern?url="+HSA_LINK+"/angebote/aktueller_zeitraum/",
    );
    xhr.responseType="document"
    xhr.send();

}




document.getElementById("loadcourses").addEventListener("click", ()=>loadCourses());
document.getElementById("loadchoice").addEventListener("click", ()=>loadChoice());
document.getElementById("refreshchoice").addEventListener("click", ()=>refreshChoice());
document.getElementById("arm").addEventListener("click", () => arm());