var db = require('./db')
const crypto = require('crypto');
const http = require('https')
var config = require('./config');
var randomstring = require("randomstring");
var request = require('request');

var refreshToken = async function (user_id) {
    const doc = await db.DBgetUserByID(user_id)

    if (!doc) {
        return {
            error: "User Authentication Error",
            message: `Cannot refresh token for user ${user_id}, as it does not exist`
        }
    }
    const response = await requestAuthToken(user_id, "grant_type=refresh_token" + "&refresh_token=" + doc.refresh_token)

    if (response.error) {
        console.log(`${user_id} no longer valid, removing from the database`)
        removeOwner(user_id)
    }

    return response
}


var getFirstTimeToken = async function (user_id, auth_code) {
    return requestAuthToken(user_id, "grant_type=ecobeePin" + "&code=" + auth_code)
}

var requestAuthToken = async function (user_id, token_options) {
    return new Promise(function (resolve, reject) {
        console.log("Requesting auth token for user " + user_id);

        const options = {
            hostname: 'api.ecobee.com',
            path: '/token?' +
                token_options +
                "&client_id=" + config.app_key,
            method: 'POST',
        };
        const req = http.request(options, (res) => {
            res.setEncoding('utf8')
            res.on('data', async (d) => {
                var doc = JSON.parse(d)

                if (!doc.error) {
                    var ts = Math.round((new Date()).getTime() / 1000);
                    doc.expires_in = ts + doc.expires_in
                    doc.auth_token = randomstring.generate()
                    doc.user_id = user_id


                    const existingUser = await db.DBgetUserByID(user_id)
                    if (existingUser) {
                        doc.auth_token = existingUser.auth_token
                    }

                    await db.DBgetDB().collection('owners').findOneAndUpdate(
                        { user_id: user_id },
                        { $set: doc },
                        {
                            upsert: true, // insert the document if it does not exist)
                            returnOriginal: false
                        }
                    )
                }
                console.log(doc)
                resolve(doc)
            })
        });

        req.on('error', (error) => {
            reject(error)
        })

        req.write('')
        req.end()
    })
}

var checkAuthenticationOwner = async function (query, res) {
    if (!query.auth_token || !query.user_id) {
        res.status(401).send({
            error: "Authentication Error",
            message: "Provided auth_token or user_id failed authentication"
        })
        throw "Parameter Error"
    }

    var ownerDocument = await db.DBgetUserByID(query.user_id)
    if (ownerDocument && ownerDocument.auth_token == query.auth_token) {
        return true
    }

    console.log(`Authentication failure for ${query.user_id}`)
    res.status(401).send({
        error: "Authentication Error",
        message: "Provided auth_token or user_id failed authentication"
    })
    throw "Parameter Error"
}


var removeOwner = async function (user_id) {
    console.log(`Deleting user ${user_id}`)
    db.DBgetDB().collection('owners').findOneAndDelete({ user_id: user_id }).then(
        db.DBgetDB().collection('grants').deleteMany({ user_id: user_id })
    )
}

var addApplication = async function (req, res) {
    if (!req.body.session_token || !req.body.pin || !req.body.auth_code || !req.body.userName) {
        res.status(422).send({
            error: "Missing parameters",
            message: "Must provide session_token, pin, auth_code, userName"
        })
        return
    }

    console.log(`Performing auxilary application authentication with pin ${req.body.pin} for ${req.body.userName}`)

    // Set the headers
    var headers = {
        'Authorization': 'Bearer ' + req.body.session_token,
        'Content-Type': 'application/json'
    }

    const options = {
        hostname: 'api.ecobee.com',
        path: '/home/api/1/developer/app/authorize?format=json',
        method: 'POST',
        headers: headers,
    };

    const pReq = http.request(options, (pRes) => {
        pRes.setEncoding('utf8')
        pRes.on('data', async (d) => {
            var doc = JSON.parse(d)
            console.log(doc)
            if (doc.success) {
                var authPromise = await getFirstTimeToken(req.body.userName, req.body.auth_code)
                if (authPromise.error) {
                    res.status(401).send(authPromise)
                    return
                }
                res.status(200).send(authPromise)
                return
            }
            res.status(401).send(doc)
        })
    });

    pReq.write(JSON.stringify({ "pin": req.body.pin }))
    pReq.end()
}

module.exports = {
    CheckAuthenticationOwner: checkAuthenticationOwner,
    AddApplication: addApplication,
    RefreshToken: refreshToken
}