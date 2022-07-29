const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
require("dotenv").config();

const PORT = process.env.PORT || process.env.API_PORT;

const app = express();
app.use(express.json());
app.use(cors());

const authRoute = require('./routes/authRoute');

app.use("/api/auth", authRoute);

console.log("Starting your server");
const server = http.createServer(app);

mongoose
    .connect(process.env.MONGO_URI)
    .then(()=>{
        server.listen(PORT, ()=>{
            console.log(`Server is listening to the PORT ${PORT}`);
        })
    })
    .catch((err)=>{
        console.log("Database connection failed. Server not started");
        console.error(err)
    })
