const pool=require('./database');
const sleep =(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));async function runWorker(){
    while(true){
        try{
        const res=await pool.query(
            `UPDATE webhook_queue 
            SET status = 'processing'
            WHERE id = (
                SELECT id FROM webhook_queue
                WHERE status = 'pending' AND next_attempt_at <= NOW()
                ORDER BY next_attempt_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, url, payload, retry_count`);
            
            if (res.rows.length===0){
                console.log("no webhooks pending.Sleeping");
                continue;
            }
                const currentJob =res.rows[0];
                console.log("Successfully locked webhook ID:",currentJob.id);
                const response=await fetch(currentJob.url,{
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': currentJob.id
                    },
                    body:JSON.stringify(currentJob.payload)
                   
                });
            await sleep(1000);
        }
        catch(error){
            await sleep(1000);
        }
    }
}
runWorker();