var db = require('./db')
var authentication = require('./authentication')
var randomstring = require("randomstring");

var addGrant = async function (req, res) {
    try {
        await authentication.CheckAuthenticationOwner(req.body, res)
    }
    catch (error) {
        return
    }

    var access_code = randomstring.generate({
        length: 6,
        charset: 'alphanumeric',
        capitalization: 'uppercase'
    })

    var grant = req.body
    delete grant["auth_token"]
    grant.access_token = null
    grant.redeemed = false
    grant.access_code = access_code

    //update with either the new provided tokens, or the ones obtained from when we performed
    //a check against the existing key
    await db.DBgetDB().collection('grants').insertOne(grant)

    delete grant["access_code"]
    delete grant["_id"]

    //TODO: we should validate the grant
    res.status(200).send(grant)
}

var getGrants = async function (req, res) {
    try {
        await authentication.CheckAuthenticationOwner(req.body, res)
    }
    catch (error) {
        return
    }

    await db.DBgetDB().collection('grants').find({ user_id: req.body.user_id }, {
        projection: {
            _id: 0,
            access_token: 0
        }
    }).toArray(function (err, result) {
        if (err) throw err;
        grants = { result }
        res.status(200).send(grants)
    });
}

var removeGrant = async function (req, res) {
    try {
        await authentication.CheckAuthenticationOwner(req.body, res)
    }
    catch (error) {
        return
    }

    await db.DBgetDB().collection('grants').findOneAndDelete({ user_id: req.body.user_id, access_code: req.body.access_code }, function (err, result) {
        if (err) throw err;
        if (!result.value) {
            res.status(400).send({
                error: "Non-existant grant",
                message: "Grant does not exist, has been revoked, or already used"
            })
            return
        }
        delete result.value["_id"]
        delete result.value["access_token"]
        res.status(200).send(result.value)
    })
}

module.exports = {
    AddGrant: addGrant,
    GetGrants: getGrants,
    RemoveGrant: removeGrant
}