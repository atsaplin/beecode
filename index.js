const express = require('express');
const app = express();
var bodyParser = require('body-parser')
var authentication = require('./authentication')
var owner_grants = require('./owner-grants')
var user_grants = require('./user-grants')
var api_requests = require('./api-requests')

app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.listen(3000, () => {
    console.log('listening on 3000')
})

app.post('/api/addGrant', owner_grants.AddGrant)
app.post('/api/getGrants', owner_grants.GetGrants)
app.post('/api/removeGrant', owner_grants.RemoveGrant)
app.post('/api/user_getGrant', user_grants.GetGrant)
app.post('/api/addApplication', authentication.AddApplication)
app.post('/api/user_activateGrant', user_grants.ActivateGrant)


app.post('/api/user_getTemperature', api_requests.GetTemperature)

