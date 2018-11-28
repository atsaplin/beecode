const express = require('express');
const MongoClient = require('mongodb').MongoClient
const app = express();
var env = process.env.NODE_ENV || 'production';
var config = require('./config')[env];

MongoClient.connect(config.server.port, (err, database) => {
    // ... start the server
})

app.listen(3000, function () {
    console.log('listening on 3000')
})

app.get('/', (req, res) => {
    res.send('Testing')
})