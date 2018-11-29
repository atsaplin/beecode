var db = require('./db')
var authentication = require('./authentication')
var randomstring = require("randomstring");

var addGrant = async function (req, res) {
    if (!(await authentication.CheckAuthentication(req.body))) {
        res.status(401).send({
            Error: "Authentication Error",
            Message: "Provided auth_token or user_id failed authentication"
        })
        return
    }

    var access_code = randomstring.generate({
        length: 6,
        charset: 'alphanumeric',
        capitalization: 'uppercase'
    })

    var grant = {
        user_id: req.body.user_id,
        thermostats: req.body.thermostats,
        home: req.body.home,
        address: req.body.address,
        start: req.body.start,
        end: req.body.end,
        access_token: null,
        access_code: access_code,
        redeemed: false
    }

    //update with either the new provided tokens, or the ones obtained from when we performed
    //a check against the existing key
    await db.DBgetDB().collection('grants').insertOne(grant)

    delete grant["_id"]

    //TODO: we should validate the grant
    res.status(200).send(grant)
}

var getGrants = async function (req, res) {
    if (!(await authentication.CheckAuthentication(req.body))) {
        res.status(401).send({
            Error: "Authentication Error",
            Message: "Provided auth_token or user_id failed authentication"
        })
        return
    }


    await db.DBgetDB().collection('grants').find({ user_id: req.body.user_id }, {
        projection: {
            _id: 0,
            access_token: 0
        }
    }).toArray(function (err, result) {
        if (err) throw err;
        grants = {result}
        res.status(200).send(grants)
    });


}

module.exports = {
    AddGrant: addGrant,
    GetGrants: getGrants
}