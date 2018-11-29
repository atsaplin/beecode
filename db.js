const MongoClient = require('mongodb').MongoClient
var config = require('./config');

var mongo_url = 'mongodb://' +
    config.database.user + ':' +
    config.database.password + '@' +
    config.database.host + ':' +
    config.database.port + '/' +
    'admin';

var db = null

MongoClient.connect(mongo_url, (err, client) => {
    if (err) return console.log(err)
    db = client.db(config.database.db) // whatever your database name is
    console.log('connected to mongodb server @' + config.database.host)
})

var getUserByID = function (id) {
    return new Promise(function (resolve, reject) {
        //check if this user has already been registered
        db.collection('owners').findOne({ user_id: id }, function (err, result) {
            if (err) reject(err)
            resolve(result)
        });
    })
}

var getDB = function (){
    return db;
}

module.exports = {
    DBgetDB: getDB,
    DBgetUserByID : getUserByID
}