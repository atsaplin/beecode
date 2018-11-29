const express = require('express');
const app = express();
var bodyParser = require('body-parser')
var authentication = require('./authentication')
var grants = require('./grants')

app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.listen(3000, () => {
    console.log('listening on 3000')
})

app.post('/api/registerOwner', authentication.RegisterOwner)
app.post('/api/addGrant', grants.AddGrant)
app.post('/api/getGrants', grants.GetGrants)
