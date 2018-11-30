var db = require('./db')
const crypto = require('crypto');
const http = require('https')
var config = require('./config');
var randomstring = require("randomstring");

var validateGrant = async function (query) {
    if (!query.access_token) {
        console.log("Grant auth check with missing access_token")
        return null
    }

    var doc = await db.DBgetDB().collection('grants').findOne({ redeemed: true, access_token: query.access_token })

    if(doc){
        var ts = Math.round((new Date()).getTime() / 1000);

        //this grant has expired
        if (ts > doc.end){
            db.DBgetDB().collection('grants').findOneAndDelete({ access_token: query.access_token })
            return null
        }
        //this gran is not yet valid
        else if (ts < doc.start){
            return null
        }
    }

    return doc
}

var getGrant = async function (req, res) {
    var grant = await validateGrant(req.body)
    if (!grant) {
        res.status(401).send({
            Error: "Authentication Error",
            Message: "Grant does not exist or has been revoked"
        })
        return
    }

    delete grant["_id"]
    delete grant["access_code"]
    delete grant["access_token"]
    delete grant["redeemed"]

    res.status(200).send(grant)
}

var activateGrant = async function (req, res) {
    if (!req.body.access_code) {
        res.status(422).send({
            Error: "Missing paramters",
            Message: "Must provide access_code"
        })
        return
    }

    var found = false

    await db.DBgetDB().collection('grants').findOneAndUpdate({
        access_code: req.body.access_code,
        redeemed: false
    }, { $set: { redeemed: true, access_token: randomstring.generate(128) } }, { upsert: false, returnOriginal: false }, function (err, doc) {
        if (err) { throw err; }
        else {
            if (!doc.value) {
                res.status(401).send({
                    Error: "Authentication Error",
                    Message: "Grant does not exist, has been revoked, or already used"
                })
                return
            }
            res.status(200).send(doc)
            console.log(`Activated grant ${req.body.access_code}`);
        }
    });
}

module.exports = {
    GetGrant: getGrant,
    ActivateGrant: activateGrant
}