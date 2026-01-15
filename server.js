const express = require("express");

const app = express();
//Converts JSON request body into JavaScript object (req.body)
app.use(express.json());

app.listen(3000,(req,res)=>{
    console.log("listen at port 3000");
})