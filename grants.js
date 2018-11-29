var db = require('./db')
var authentication = require('./authentication')

var addGrant = async function (req, res) {

    if (!authentication.CheckAuthentication(req.body)){
        res.status(401).send({
            Error: "Authentication Error",
            Message: "Provided auth_token or user_id failed authentication"
        })
        return
    }

    console.log(req.body)

}

module.exports = {
    AddGrant: addGrant
}