var db = require('./db')
const crypto = require('crypto');
const http = require('https')
var config = require('./config');
var randomstring = require("randomstring");

var validateGrant = async function (query, res) {
    if (!query.access_token) {
        res.status(401).send({
            error: "Authentication Error",
            message: "Provided auth_token or user_id failed authentication"
        })
        throw "Parameter Error"
    }

    var doc = await db.DBgetDB().collection('grants').findOne({ redeemed: true, access_token: query.access_token })

    if (doc) {
        var ts = Math.round((new Date()).getTime() / 1000);

        //this grant has expired
        if (ts > doc.end) {
            db.DBgetDB().collection('grants').findOneAndDelete({ access_token: query.access_token })
            res.status(401).send({
                error: "Grant expired",
                message: "This grant has expired"
            })
            throw "Grant Expired"
        }
        //this gran is not yet valid
        else if (ts < doc.start) {
            res.status(401).send({
                error: "Grant not yet valid",
                message: `This grant is valid but not active till ${doc.start}`
            })
            throw "Grant Not Yet Active"
        }
    }else{
        res.status(401).send({
            error: "Grant Invalid",
            message: "This grant has been revoked or never existed"
        })
        throw "Grant Invalid"
    }
}

var getGrant = async function (req, res) {
    try {
        await validateGrant(req.body, res)
    }
    catch (error) {
        return
    }

    var grant = await db.DBgetDB().collection('grants').findOne({ redeemed: true, access_token: req.body.access_token })

    delete grant["_id"]
    delete grant["user_id"]
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
                    error: "Authentication Error",
                    message: "Grant does not exist, has been revoked, or already used"
                })
                return
            }

            delete doc.value["_id"]
            delete doc.value["user_id"]

            res.status(200).send(doc.value)
            console.log(`Activated grant ${req.body.access_code}`);
        }
    });
}

module.exports = {
    GetGrant: getGrant,
    ValidateGrant: validateGrant,
    ActivateGrant: activateGrant
}