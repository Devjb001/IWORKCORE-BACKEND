const mongoose = require ('mongoose')
require("dotenv").config()

function connectToDataBase() {

    mongoose.connect(process.env.MONGODB_URI)

    mongoose.connection.on('connected' , () => {
        console.log('Connected to Database Successfully ')
    })

     mongoose.connection.on('error' , () => {
        console.log('Failed Connecting to Database ')
    })
}

module.exports = {connectToDataBase}