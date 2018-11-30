var db = require('./db')
const http = require('https')
var config = require('./config');
var user_grants = require('./user-grants')

var getAccessToken = function (user_id, res) {
}

var getTemperature = async function (req, res) {
    try {
        await user_grants.ValidateGrant(req.body, res)
    }
    catch (error) {
        return
    }

    res.status(200).send()
}

module.exports = {
    GetTemperature: getTemperature
}