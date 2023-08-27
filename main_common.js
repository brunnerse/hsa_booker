function fun() {
    document.getElementById("demo").innerHTML = "Paragraph changed.";
}

function exec() {
    
    let opts = {
        'mode': 'no-cors'
    }

    fetch("http://ismycomputeron.com", opts)
        .then((response) => {
            console.log("got status %d", response.status);
            document.getElementById("courses").innerHTML = response.text();
            
        })
        .catch((err) => {
            document.getElementById("courses").innerHTML = "failed " + err.text;
        });

}


function execXML() {
    console.log("Executing XML...");
    const xhr = new XMLHttpRequest();

    xhr.onerror = () => {
            document.getElementById("courses").innerHTML = "failed ";
        };
    xhr.onload = () => {
        console.log("Loaded.");
        console.log(xhr.status)
        console.log(xhr.response)
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



document.getElementById("xhr").addEventListener("click", ()=>execXML());
document.getElementById("requesturl").addEventListener("keyup", callOnEnter);