var clickX = new Array();
var clickY = new Array();
var clickDrag = new Array();
var paint;
var context;
var canvas;

function addClick(x, y, dragging)
{
    clickX.push(x);
    clickY.push(y);
    clickDrag.push(dragging);
}

function redraw(){
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas

    context.strokeStyle = "#1e88e5";
    context.lineJoin = "round";
    context.lineWidth = Math.round($("#drawingCanvas").width()/15);

    for(var i=0; i < clickX.length; i++) {
        context.beginPath();
        if(clickDrag[i] && i){
            context.moveTo(clickX[i-1], clickY[i-1]);
        }else{
            context.moveTo(clickX[i]-1, clickY[i]);
        }
        context.lineTo(clickX[i], clickY[i]);
        context.closePath();
        context.stroke();
    }
}

function renderResults(resultsJson) {
    var resultsElement = $('#results');
    var html = ""
    //resultsJson["results"].length
    for (var ind = 0; ind < 4; ind++) {
        resHtml = "<div class=\"row valign-wrapper prediction-record\">\n" +
            "                    <div class=\"col s4\">\n" +
            "                        <h5 class=\"prediction-label\">Digit " + resultsJson["results"][ind]["digit"] + "</h5>\n" +
            "                    </div>\n" +
            "                    <div class=\"col s5\" id=\"res_digit_" + resultsJson["results"][ind]["digit"] + "\">\n" +
            "                    </div>\n" +
            "                    <div class=\"col s3\">\n" +
            "                        <h5 class=\"prediction-label\">" + Math.round(resultsJson["results"][ind]["score"]*100) + "%</h5>\n" +
            "                    </div>\n" +
            "                </div>"
        html += resHtml;
    }
    resultsElement.append($(html));

    for (var ind = 0; ind < 4; ind++) {
        var digitResId = "#res_digit_" + resultsJson["results"][ind]["digit"]
        var element = $(digitResId)[0]

        var bar = new ProgressBar.Line(element, {
               strokeWidth: 2,
               easing: 'easeInOut',
               duration: 1400,
               color: '#1e88e5',
               trailColor: '#eee',
               trailWidth: 1,
               svgStyle: {width: '100%', height: '100%'},
               from: {color: '#1e88e5'},
               to: {color: '#1e88e5'},
               step: (state, bar) => {
                   bar.path.setAttribute('stroke', state.color);
               }
           });

           bar.animate(resultsJson["results"][ind]["score"]);
    }
}

function prepareCanvas() {

    document.getElementById('drawingCanvas').setAttribute('width', $("#drawingCanvas").width());
    document.getElementById('drawingCanvas').setAttribute('height', $("#drawingCanvas").height());
    context = document.getElementById('drawingCanvas').getContext("2d");
    canvas = document.getElementById("drawingCanvas");

    function press(e){
        var canvasEl = document.getElementById("drawingCanvas")
        var mouseX = e.pageX - canvasEl.offsetLeft;
        var mouseY = e.pageY - canvasEl.offsetTop;

        paint = true;
        addClick(e.pageX - canvasEl.offsetLeft, e.pageY - canvasEl.offsetTop);
        redraw();
    }

    function move(e) {
        var canvasEl = document.getElementById("drawingCanvas")
        if(paint){
            addClick(e.pageX - canvasEl.offsetLeft, e.pageY - canvasEl.offsetTop, true);
            redraw();
        }
    }

    function free(e){
        paint = false;
    }

    $('#drawingCanvas').mousedown(press);

    $('#drawingCanvas').mousemove(move);

    $('#drawingCanvas').mouseup(free);

    $('#drawingCanvas').mouseleave(function(e){
        paint = false;
    });

    document.body.addEventListener("touchstart", function (e) {
        if (e.target == canvas) {
            e.preventDefault();
            press(e);
        }
    }, {passive: false});
    document.body.addEventListener("touchend", function (e) {
        if (e.target == canvas) {
            e.preventDefault();
            free(e);
        }
    }, {passive: false});
    document.body.addEventListener("touchmove", function (e) {
        if (e.target == canvas) {
            e.preventDefault();
            move(e);
        }
    }, {passive: false});

}

function clearCanvas() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    clickX = new Array();
    clickY = new Array();
    clickDrag = new Array();
    paint = false;
    $('#results').empty();
}

function recognizeDigit() {
    var imgSrc = canvas.toDataURL();
    var auxCanvas = document.getElementById("auxCanvas");
    auxCanvas.setAttribute('width', 28);
    auxCanvas.setAttribute('height', 28);
    var auxContext = auxCanvas.getContext('2d');
    var auxImage = new Image();
    auxImage.src = imgSrc;
    auxImage.onload = function(){
        auxContext.drawImage(auxImage, 0, 0, context.canvas.width, context.canvas.height, 0, 0, 28, 28);
        var canvasData  = auxContext.getImageData(0, 0, 28, 28).data;
        recognitionRoutine(canvasData);
    }
}

function recognitionRoutine(canvasData) {
    startLoading();
    var modelData = prepareModelData(canvasData);
    modelCall(modelData).then((predictions) => {
        stopLoading();
        renderResults(predictions);
    });
}

function prepareModelData(canvasData) {
    var imageBinary = [];
    for (var pixelInd = 0; pixelInd < 28 * 28; pixelInd++) {
        let pixelSeriesInd = pixelInd * 4;
        if (canvasData[pixelSeriesInd] > 0 || canvasData[pixelSeriesInd+1] > 0|| canvasData[pixelSeriesInd+2] > 0) {
            imageBinary.push(1.0);
        } else {
            imageBinary.push(0.0);
        }
    }

    var modelData = [];
    for (var rowInd = 0; rowInd < 28; rowInd++) {
        var row = [];
        for (var colInd = 0; colInd < 28; colInd++) {
            row.push([imageBinary[rowInd * 28 + colInd]]);
        }
        modelData.push(row);
    }

    // var modelData = [];
    // for (var colInd = 0; colInd < 28; colInd++) {
    //     var col = [];
    //     for (var rowInd = 0; rowInd < 28; rowInd++) {
    //         col.push([imageBinary[rowInd * 28 + colInd]]);
    //     }
    //     modelData.push(col);
    // }

    return modelData;
}

function modelCall(modelData) {
    return new Promise((resolve, reject) => {
        ajaxReq = new XMLHttpRequest();
        ajaxReq.timeout = 600000;
        ajaxReq.open('post', '/mnistDigitRecognition', true);
        ajaxReq.setRequestHeader("Content-Type", "application/json");
        ajaxReq.setRequestHeader("Accept", "application/json");
        ajaxReq.onreadystatechange = function () {
            if (this.readyState == 4) {
                var responseJson = JSON.parse(this.responseText);
                if (this.status == 200) {
                    resolve(responseJson['message']);
                }
                if (this.status == 500) {
                    reject(responseJson['message']);
                }
            }
        }
        ajaxReq.send(JSON.stringify({"data": modelData}));
    });
}

function startLoading() {
    $('#clearCanvasButton').addClass('disabled');
    $('#sendButton').addClass('disabled');
    $('#progressBar').show();
    $('#results').empty();
}

function stopLoading() {
    $('#clearCanvasButton').removeClass('disabled');
    $('#sendButton').removeClass('disabled');
    $('#progressBar').hide();
}