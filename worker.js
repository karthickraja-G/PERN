const pool=require('./config/database');
const axios =require('axios');




const sleep =(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));async function runWorker(){
    console.log("worker initilized. starting core loop...");
    try{
        console.log("[Startup] Sweeping for stuck PROCESSING webhooks...");
        //rescues webhook stranded in 'processing' state from past crash
        const sweepResult = await pool.query(
            `UPDATE webhook_queue
            SET status ='RETRYING',
                retry_at=NOW(),
                updated_at=NOW()
            WHERE status ='PROCESSING'
                AND updated_at <NOW()-INTERVAL '5 minutes';`
        );
        console.log(`[Startup] crash recovery compelete.rescued ${sweepResult.rowCount} started webhooks.`)

    }catch(startupErr){
        console.log(`[Startup] critical failure running crash recovery sweep:`,startupErr);
    }
    while(true){
        let client = null;
        // let clientReleased=false;
        try{
            client =await pool.connect();
            await client.query("BEGIN");
            const result = await client.query(
                `SELECT id,url,payload,retry_count,max_retries
                FROM webhook_queue
                WHERE status IN ('PENDING','RETRYING')
                    AND retry_at<=NOW()
                FOR UPDATE SKIP LOCKED
                LIMIT 1`
            );
            //if no jobs available , commit,release client,sleep and try again
            if(result.rows.length === 0){
                await client.query("COMMIT");
                // client.release();
                await sleep(1000);
                continue;            
            }
            const webhook =result.rows[0];

            await client.query(
                `UPDATE webhook_queue SET status = 'PROCESSING',updated_at=NOW() WHERE id =$1;`,
                [webhook.id]
            );
            //commit the transaction early so we dont hold the db row lock during the network call
            await client.query("COMMIT");
            client.release();
            // clientReleased=true;
            const activeWebhook = webhook;
            client = null;

            //the post method
            console.log(`[worker]Delivering webhook ${webhook.id} to ${webhook.url}`);

            try{
                await axios.post(webhook.url,webhook.payload,{timeout:5000});
                // await Promise.resolve();
                //if succes update process to success
                await pool.query(
                    `UPDATE webhook_queue SET status ='SUCCESS',updated_at=NOW() WHERE id =$1;`,
                    [activeWebhook.id] 
                );
                console.log(`[worker] webhook ${webhook.id} sent successfully.`);

            }catch(networkError){
                console.error(`[worker] Network request failed for webhook ${webhook.id}`)
                //exponential backoff calculation 
                const nextRetryCount = webhook.retry_count +1;
                if(nextRetryCount >=webhook.max_retries){
                    //if fails it will fail permanentaly
                    await pool.query(`UPDATE webhook_queue SET status = 'FAILED',updated_at=NOW() where id=$1;`,
                    [activeWebhook.id]
                    );
                    console.error(`[worker] webhook ${activeWebhook.id} failed permanently.`);
                }else{
                    //backoff logic :2^ retry_count sec(2,4,8,16,32......)
                    const delaySeconds=Math.pow(2,nextRetryCount);
                    await pool.query(
                        `UPDATE webhook_queue
                        SET status = 'RETRYING',
                            retry_count=$1,
                            retry_at=NOw()+($3 || 'seconds')::INTERVAL ',
                            updated_at=NOW()
                        WHERE id=$2;`,
                        [nextRetryCount,activeWebhook.id,delaySeconds]
                    );
                    console.warn(`[Worker] Retrying webhook ${webhook.id} in ${delaySeconds} seconds`);
                }
            }

        }catch(err){
            //this catch block now strictly handles db/runtime transaction failures
    
            console.error(err);
            if(client){
                try{
                    await client.query("ROLLBACK");
                }
                catch(e){

                }
            }
            await sleep(5000);
        }finally{
            if(client && typeof client.release === 'function'){
                try{
                    client.release();
                }catch(releaseErr){
                    console.error("Error during emergency release:",releaseErr);
                }
        }
    }

    }
}

module.exports={runWorker};