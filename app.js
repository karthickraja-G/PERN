const express = require('express');
const pool=require('./config/database');
const {runWorker}=require('./worker');
const cors = require("cors");
const app = express();

//middleware
app.use(express.json());
app.use(cors());


//get
app.get('/', (req, res) => {
  res.send('Hello World!');
});

//post

app.post('/webhook',async (req, res) => {
  
    //1> extract the data
    const {url,payload}=req.body;
    //2. validation 
    if(!url ||  ! payload){
      return res.status(400).json({error:"Url asn payload are required"});
    }
    try{
    await pool.query(
      `INSERT INTO webhook_queue (url, payload, status, retry_count, retry_at)
       VALUES ($1, $2, 'PENDING', 0, NOW());`,
      [url, JSON.stringify(payload)]
    );
    res.status(202).json({message:"webhook accepted and queued"});
  }
  catch(error){
    console.error(error);
    res.status(500);
  }
  
});



app.listen(3000,() =>{
    console.log("Server is running on port 3000");
    console.log("[Worker] Starting backround engine loop...");

    runWorker().catch(err=> console.error("Worker loop encountered an error:",err));
});