var db = require('./db')
const http = require('https')
var config = require('./config');
var user_grants = require('./user-grants')
var response = require('./response.json')
var authentication = require('./authentication')


var getAccessToken = async function (userDoc, res) {

    var ts = Math.round((new Date()).getTime() / 1000);

    //if the expiry date is less than 60 in the future
    if (userDoc.expires_in < ts + 60) {
        console.log(`Token for ${userDoc.user_id} to expire soon, refreshing`)
        var auth_response = await authentication.RefreshToken(userDoc.user_id)
        if (auth_response.error) {
            res.status(401).send(auth_response)
            return null
        }
        return auth_response.access_token
    }

    return userDoc.access_token
}

var getTstatInfo = async function (req, res) {
    var query = {
        "selection": {
            "includeRuntime": true,
            "includeEvents": true,
            "includeSettings": true,
            "includeSensors": true,
            "includeEquipmentStatus": true
        }
    }
    var response = await makeRequest(req, res, query, 'GET')
    res.status(200).send(getMinData(response))
}

var setHold = async function (req, res) {
    if (!req.body.heat || !req.body.cool) {
        res.status(422).send({
            error: "Missing parameters",
            message: "Must provide heat, cool"
        })
        return
    }

    var query = {
        "selection": {
        },
        "functions": [
            {
                "type": "setHold",
                "params": {
                    "holdType": "indefinite",
                    "heatHoldTemp": req.body.heat,
                    "coolHoldTemp": req.body.cool
                }
            }
        ]
    }
    res.status(200).send(makeRequest(req, res, query, 'POST'))
}

var cancelHold = async function (req, res) {

    var query = {
        "selection": {
        },
        "functions": [
            {
                "type": "resumeProgram",
                "resumeAll": true
            }
        ]
    }
    res.status(200).send(makeRequest(req, res, query, 'POST'))
}

var makeRequest = function (req, res, query, requestType) {

    return new Promise(async function (resolve, reject) {
        var grant
        try {
            grant = await user_grants.ValidateGrant(req.body, res)
        }
        catch (error) {
            return
        }

        const doc = await db.DBgetUserByID(grant.user_id)
        var token = await getAccessToken(doc, res)

        // Set the headers
        var headers = {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'text/json'
        }

        query.selection.selectionType = "thermostats"
        query.selection.selectionMatch = grant.thermostats.join()


        const options = {
            hostname: 'api.ecobee.com',
            path: '/1/thermostat?format=json&body=' + JSON.stringify(query),
            headers,
            method: requestType,
        };

        const reqPost = http.request(options, (resPost) => {
            resPost.setEncoding('utf8')
            var data = ""
            resPost.on('data', async (d) => {
                //var doc = JSON.parse(d)
                if (d) {
                    data += d
                }
            })

            resPost.on('end', async (d) => {
                data = JSON.parse(data)
                if (data.status.code == 0) {
                    resolve(data)
                } else { //failed to authernticate
                    res.status(401).send(data)
                    console.log(`${grant.user_id} failed authentication`)
                    authentication.RemoveOwner(grant.user_id)
                }
            })
        });

        req.on('error', (error) => {
            reject(error)
        })

        reqPost.write('')
        reqPost.end()
    })
}

var getMinData = function (fullResponse) {
    const tstat = fullResponse.thermostatList[0]
    var response = {
        identifier: tstat.identifier,
        name: tstat.name,
        hvacMode: tstat.settings.hvacMode,
        useCelsius: tstat.settings.useCelsius,
        holdAction: tstat.settings.holdAction,
        actualTemperature: tstat.runtime.actualTemperature,
        actualHumidity: tstat.runtime.actualHumidity,
        desiredHeat: tstat.runtime.desiredHeat,
        desiredCool: tstat.runtime.desiredCool,
        connected: tstat.runtime.connected,
        eventType: tstat.events[0].type,
        coolHoldTemp: tstat.events[0].coolHoldTemp,
        heatHoldTemp: tstat.events[0].heatHoldTemp,

    }
    return response
}

module.exports = {
    GetTstatInfo: getTstatInfo,
    SetHold: setHold,
    CancelHold: cancelHold,
}