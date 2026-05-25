const express = require('express');
const pool=require('./database');
const app = express();
app.use(express.json());
app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.post('/webhook',async (req, res) => {
  try{
    const {url,payload}=req.body;
    await pool.query(
      `INSERT INTO webhook_queue (url, payload, status, retry_count, next_attempt_at)
       VALUES ($1, $2, 'pending', 0, NOW());`,
      [url, JSON.stringify(payload)]
    );
    res.sendStatus(201);
  }
  catch(error){
    console.error(error);
    res.sendStatus(500);
  }
  
});
app.listen(3000,() =>{
    console.log("Server is running on port 3000")
});