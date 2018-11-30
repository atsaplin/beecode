var db = require('./db')
const crypto = require('crypto');
const http = require('https')
var config = require('./config');
var randomstring = require("randomstring");
var request = require('request');


var getNewAuthToken = function (ownerDocument) {
    return new Promise(function (resolve, reject) {
        console.log("Requesting new auth token for user " + ownerDocument.user_id);

        const options = {
            hostname: 'api.ecobee.com',
            path: '/token?' +
                "grant_type=refresh_token" +
                "&refresh_token=" + ownerDocument.refresh_token +
                "&client_id=" + config.app_key,
            method: 'POST',
        };
        const req = http.request(options, (res) => {
            res.setEncoding('utf8')
            res.on('data', (d) => {
                console.log(d)
                resolve(JSON.parse(d))
            })
        });

        req.on('error', (error) => {
            reject(error)
        })

        req.write('')
        req.end()
    })
}

var checkAuthenticationOwner = async function (query) {
    if (!query.auth_token || !query.user_id) {
        console.log("Authentication check with missing auth_token or user_id")
        return false
    }

    var ownerDocument = await db.DBgetUserByID(query.user_id)
    if (ownerDocument && ownerDocument.auth_token == query.auth_token) {
        return true
    }

    console.log(`Authentication failure for ${query.user_id}`)
    return false
}


var removeOwner = async function (user_id) {
    console.log(`Deleting user ${user_id}`)
    db.DBgetDB().collection('owners').findOneAndDelete({ user_id: user_id }).then(
        db.DBgetDB().collection('grants').deleteMany({ user_id: user_id })
    )
}

var registerOwner = async function (ownerDoc){

    var newDoc = {
        user_id: ownerDoc.user_id,
        access_token: ownerDoc.access_token,
        refresh_token: ownerDoc.refresh_token,
        expires_in: ownerDoc.expires_in,
        auth_token: randomstring.generate()
    }

    console.log(`Attempting to register user ${ownerDoc.user_id}`)

    var ownerDocument = await db.DBgetUserByID(ownerDoc.user_id)
    var alreadyExistsAndValid = false
    //if user still exists we must make sure he is no longer authenticated before we replace
    if (ownerDocument) {
        console.log(`${ownerDoc.user_id} already exists, checking refresh tokens`);

        //try to check to see if old refresh token is still valid
        const authPromise = await getNewAuthToken(ownerDocument)

        if (!authPromise.error) {
            console.log(`${ownerDoc.user_id} already has valid refresh token`)

            alreadyExistsAndValid = true;

            //update the auth and refresh tokens
            newDoc.access_token = authPromise.access_token
            newDoc.refresh_token = authPromise.refresh_token
            newDoc.expires_in = authPromise.expires_in
            newDoc.auth_token = ownerDocument.auth_token
        }
        else {
            console.log(`${ownerDoc.user_id} old token is invalid, replacing refresh token`)
        }
    }

    if (!alreadyExistsAndValid) {
        //validate the new document
        const authPromise = await getNewAuthToken(newDoc)
        if (authPromise.error) {
            console.log(`${ownerDoc.user_id} no longer valid, removing from the database`)
            removeOwner(ownerDoc.user_id)
            return authPromise
        }
    }

    //update with either the new provided tokens, or the ones obtained from when we performed
    //a check against the existing key
    await db.DBgetDB().collection('owners').findOneAndUpdate(
        { user_id: newDoc.user_id },
        { $set: newDoc },
        {
            new: true,   // return new doc if one is upserted
            upsert: true // insert the document if it does not exist)
        }
    )

    if (alreadyExistsAndValid) {
        return {
            error: "Authorization error",
            Message: `${ownerDoc.user_id} already has valid refresh token`
        }
    }

    return newDoc
}

var requestFirstTimeAuthToken = async function (authDoc) {
    return new Promise(function (resolve, reject) {
        console.log("Requesting first-time auth token for user " + authDoc.userName);

        const options = {
            hostname: 'api.ecobee.com',
            path: '/token?' +
                "grant_type=ecobeePin" +
                "&code=" + authDoc.auth_code +
                "&client_id=" + config.app_key,
            method: 'POST',
        };
        const req = http.request(options, (res) => {
            res.setEncoding('utf8')
            res.on('data', (d) => {
                console.log(d)
                resolve(JSON.parse(d))
            })
        });

        req.on('error', (error) => {
            reject(error)
        })

        req.write('')
        req.end()
    })
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

    const pReq = http.request(options,  (pRes) => {
        pRes.setEncoding('utf8')
        pRes.on('data', async (d) => {
            if (JSON.parse(d).success) {
                const authPromise = await requestFirstTimeAuthToken(req.body)
                if (!authPromise.error) {
                    var ownerDoc = {
                        user_id: req.body.userName,
                        access_token: authPromise.access_token,
                        refresh_token: authPromise.refresh_token,
                        expires_in: authPromise.expires_in
                    }
                    const addedOwner = await registerOwner(ownerDoc)
                    if (addedOwner.error){
                        res.status(401).send(addedOwner)
                        return
                    }
                    res.status(200).send(addedOwner)
                    return
                }
            }
            res.status(401).send(d)
        })
    });

    pReq.write(JSON.stringify({ "pin": req.body.pin }))
    pReq.end()
}

module.exports = {
    CheckAuthenticationOwner: checkAuthenticationOwner,
    AddApplication: addApplication
}