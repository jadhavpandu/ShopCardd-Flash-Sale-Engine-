require("dotenv").config();
const express = require("express");
const {connectDB} = require("./database");


const app = express();
//Converts JSON request body into JavaScript object (req.body)
app.use(express.json());

app.get("/home",(req,res)=>{
    res.send("this is the jsut for check server on 4000");
})
connectDB();
app.listen(4000,(req,res)=>{
    console.log("listen at port 3000");
})





