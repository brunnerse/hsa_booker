HSA_LINK = "https://web.archive.org/web/20220810201020/https://anmeldung.sport.uni-augsburg.de"
//HSA_LINK = "https://anmeldung.sport.uni-augsburg.de"


function fun() {
    document.getElementById("demo").innerHTML = "Paragraph changed.";
}


function loadCourses() {
    const xhr = new XMLHttpRequest();

    xhr.onerror = () => {
            document.getElementById("courses").innerHTML = "failed ";
        };
    xhr.onload = () => {
        console.log("Loaded.");
        console.log(xhr.getAllResponseHeaders())
        console.log(xhr.status)
        //console.log(xhr.response)
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
         doc.getElementsByClassName("item-page")[0].outerHTML
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


function execXML() {
    console.log("Executing XML...");
    const xhr = new XMLHttpRequest();

    xhr.onerror = () => {
            document.getElementById("courses").innerHTML = "failed ";
        };
    xhr.onload = () => {
        console.log("Loaded [Status ${xhr.status}]");
        //console.log(xhr.response)
    };
    xhr.onloadend = () => {
        console.log("Load end.");
        document.getElementById("courses").innerHTML = xhr.responseText;
    }

    xhr.open(
      "GET",
      "extern?url="+document.getElementById("requesturl").value,
    );
    xhr.send();

}

function callOnEnter(event) {
    if (event.which == 13) {
        execXML();
    }
}


document.getElementById("loadcourses").addEventListener("click", ()=>loadCourses());
document.getElementById("xhr").addEventListener("click", ()=>execXML());
document.getElementById("requesturl").addEventListener("keyup", callOnEnter);