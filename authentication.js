var db = require('./db')
const crypto = require('crypto');
const http = require('https')
var config = require('./config');
var randomstring = require("randomstring");


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

var checkAuthentication = async function (query) {
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
        db.DBgetDB().collection('grants').deleteMany({user_id: user_id})
    )
}

var registerOwner = async function (req, res) {
    if (!req.body.user_id || !req.body.access_token || !req.body.refresh_token || !req.body.expires_in) {
        res.status(422).send({
            Error: "Missing paramters",
            Message: "Must provide user_id, access_token, refresh_token, expires_in"
        })
        return
    }

    var newDoc = {
        user_id: req.body.user_id,
        access_token: req.body.access_token,
        refresh_token: req.body.refresh_token,
        expires_in: req.body.expires_in,
        auth_token: randomstring.generate()
    }

    console.log(`Attempting to register user ${req.body.user_id}`)

    var ownerDocument = await db.DBgetUserByID(req.body.user_id)
    var alreadyExistsAndValid = false
    var newTokenValid = true

    //if user still exists we must make sure he is no longer authenticated before we replace
    if (ownerDocument) {
        console.log(`${req.body.user_id} already exists, checking refresh tokens`);

        //try to check to see if old refresh token is still valid
        const authPromise = await getNewAuthToken(ownerDocument)

        if (!authPromise.error) {
            console.log(`${req.body.user_id} already has valid refresh token`)

            alreadyExistsAndValid = true;

            //update the auth and refresh tokens
            newDoc.access_token = authPromise.access_token
            newDoc.refresh_token = authPromise.refresh_token
            newDoc.expires_in = authPromise.expires_in
            newDoc.auth_token = ownerDocument.auth_token
        }
        else {
            console.log(`${req.body.user_id} old token is invalid, replacing refresh token`)
        }
    }

    if (!alreadyExistsAndValid) {
        //validate the new document
        const authPromise = await getNewAuthToken(newDoc)
        if (authPromise.error) {
            res.status(401).send(authPromise)
            console.log(`${req.body.user_id} no longer valid, removing from the database`)
            removeOwner(req.body.user_id)
            return
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
        res.status(400).send({
            Error: "Authorization error",
            Message: `${req.body.user_id} already has valid refresh token`
        })
    } else if (newTokenValid) {
        res.status(200).send(newDoc)
    }
}

module.exports = {
    RegisterOwner: registerOwner,
    CheckAuthentication: checkAuthentication
}