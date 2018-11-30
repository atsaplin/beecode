var db = require('./db')
const http = require('https')
var config = require('./config');
var user_grants = require('./user-grants')
var response = require('./response.json')


var getAccessToken = function (user_id, res) {
}

var getTstatInfo = async function (req, res) {
    // var grant
    // try {
    //     grant = await user_grants.ValidateGrant(req.body, res)
    // }
    // catch (error) {
    //     return
    // }

    // const doc = await db.DBgetUserByID(grant.user_id)


    res.status(200).send(response)
}

var sendRequest = function () {
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

module.exports = {
    GetTstatInfo: getTstatInfo
}