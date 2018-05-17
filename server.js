let credentials = {
    "instance_id": "",
    "published_model_id": "",
    "deployment_id": "",
    "user": "",
    "password": ""
}


var express = require('express')
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var bodyParser = require('body-parser');

app = express();
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json({limit: '150mb', type: 'application/json'}));
let port = 8080;

var server = http.createServer(app);
server.listen(port);

app.post("/mnistDigitRecognition", function (req, res) {
    try {
        var imageData = req.body["data"];
        wmlAuthenticate().then((authToken) => {
            return mnistModelRequet(authToken, imageData)
        }).then((predictions) => {
            sortedList = generateSortedResultsJson(predictions);
            res.status(200);
            res.json({"status": 0, "message": sortedList});
            res.end();
        }).catch((err) => {
            console.error(err);
            res.status(500);
            res.json({"status": 1, "message": err});
            res.end();
        })
    } catch (err) {
        console.error(err);
        res.status(500);
        res.json({"status": 1, "message": "Error during executing endpoint \"/mnistDigitRecognition\". Error: \"" + err + "\""});
        res.end();
    }
});

function wmlAuthenticate() {
    let buffer = new Buffer(credentials["user"] + ":" + credentials["password"]);
    let authStringBase64 = buffer.toString('base64');
    const tokenHeader = "Basic " + authStringBase64;
    let header = {"Authorization": tokenHeader, "Content-Type": "application/json"};
    let postOption = {
        host: 'ibm-watson-ml.mybluemix.net',
        path: '/v3/identity/token',
        headers: header,
        method: 'GET'
    };

    return new Promise((resolve, reject) => {
        var req = https.request(postOption, (res) => {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                if (res.statusCode == 200) {
                    let bodyJson = JSON.parse(body);
                    resolve("Bearer " + bodyJson["token"]);
                } else {
                    let errorMessage = "Error during obtaining WML token" + res.statusCode + ".";
                    reject(errorMessage);
                }
            });
        });

        req.on('error', function (error) {
            reject('Error during obtaining WML token: ' + error.message + '.');
        });

        req.end();
    });
}

function mnistModelRequet(token, imageData) {
    let header = {"Accept": "application/json", "Authorization": token, "Content-Type": "application/json;charset=UTF-8"};
    let postOption = {
        host: 'ibm-watson-ml.mybluemix.net',
        path: '/v3/wml_instances/' + credentials["instance_id"] + '/published_models/' +
        credentials["published_model_id"] + '/deployments/' + credentials["deployment_id"] + '/online',
        headers: header,
        method: 'POST'
    };

    return new Promise((resolve, reject) => {
        var req = https.request(postOption, (res) => {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                if (res.statusCode == 200) {
                    let bodyJson = JSON.parse(body);
                    resolve(bodyJson["values"][0]);
                } else {
                    let errorMessage = "Error during performing WML recognition call: " + res.statusCode + ". Message: " + body;
                    reject(errorMessage);
                }
            });
        });

        req.on('error', function (error) {
            reject('Error during performing WML recognition call: ' + error.message + '.');
        });

        req.write(JSON.stringify({"values": [imageData]}));
        req.end();
    });
}

function generateSortedResultsJson(predictions) {
    var resJson = {"results": []};
    for(var ind = 0; ind < predictions.length; ind++) {
        resJson["results"].push({"digit": ind, "score": predictions[ind]})
    }

    function compare(a,b) {
        if (a.score < b.score)
            return 1;
        if (a.score > b.score)
            return -1;
        return 0;
    }

    resJson["results"].sort(compare);
    return resJson;
}
