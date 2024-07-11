import * as fs from 'fs';
import { ethers } from "ethers";
import * as cron from 'node-cron';

require("dotenv").config();

const rpc = 'https://xai-chain.net/rpc';
const provider = new ethers.JsonRpcProvider(rpc);
const shadowforgeAbi = JSON.parse(fs.readFileSync('abis/shadowforge.abi.json', 'utf8'))
const forgeContract = new ethers.Contract("0x94f84d94A1b8Ce60C5F99eAF89b4679bf9Bf598c", shadowforgeAbi, provider);
const shadowcornItemsAbi = JSON.parse(fs.readFileSync('abis/shadowcornItems.abi.json', 'utf8'))
const itemsContract = new ethers.Contract("0xbd3b68b0e37aa534ac62a867b09ced90faeb8e22", shadowcornItemsAbi, provider);

const MAX_RITUAL_MINT = 50
const HUSKS_PER_RITUAL = 50

const FIRE_TOKEN = 37
const SLIME_TOKEN = 38
const VOLT_TOKEN = 39
const SOUL_TOKEN = 40
const NEBULA_TOKEN = 41

const FIRE_RITUAL = 1
const SLIME_RITUAL = 2
const VOLT_RITUAL = 3
const SOUL_RITUAL = 4
const NEBULA_RITUAL = 5

//hourly on the 4th minute
cron.schedule('4 * * * *', () => {
    console.log("Entering The Dark Forest")
    enterTheDarKForest();
});

//daily at 00:44 UTC
cron.schedule('44 0 * * *', () => {
    console.log("Trying to Claim Daily Rewards")
    claimDailyRewards();
}, {
    timezone: "UTC"
  });


async function enterTheDarKForest() {
    try{
       
        if(!process.env.PRIVATE_KEY ){
            console.log("add a private key to the .env file")
            return
        }
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
        const connectedContract = <ethers.Contract>forgeContract.connect(signer)


        await claimAndRestake(signer, connectedContract);
    
        const tokenArray = [FIRE_TOKEN,SLIME_TOKEN,VOLT_TOKEN,SOUL_TOKEN,NEBULA_TOKEN]
        const addressArray: string[] = []
        tokenArray.forEach(element => {
            addressArray.push(signer.address)
        });
        const huskBalanceResults = await itemsContract.balanceOfBatch(addressArray, tokenArray);
        if (!huskBalanceResults) return;

        const rituals = new Map<number, number>();
        rituals.set(FIRE_RITUAL, Math.floor(Number(huskBalanceResults[0]) / HUSKS_PER_RITUAL));
        rituals.set(SLIME_RITUAL, Math.floor(Number(huskBalanceResults[1]) / HUSKS_PER_RITUAL));
        rituals.set(VOLT_RITUAL, Math.floor(Number(huskBalanceResults[2]) / HUSKS_PER_RITUAL));
        rituals.set(SOUL_RITUAL, Math.floor(Number(huskBalanceResults[3]) / HUSKS_PER_RITUAL));
        rituals.set(NEBULA_RITUAL, Math.floor(Number(huskBalanceResults[4]) / HUSKS_PER_RITUAL));

        await mintMinions(rituals, connectedContract);
        
    } catch (e: Error | any) {
        console.log(e)
        e.code && e.info && console.error(`⚠️ ${e.code} (${e.info.error.shortMessage})`)
    }
}


async function mintMinions(rituals: Map<number, number>, connectedContract: ethers.Contract) {
    let totalRituals = Array.from(rituals.values()).reduce((acc, count) => acc + count, 0);
    console.log(`total start rituals ${totalRituals}`)
    while (totalRituals >= MAX_RITUAL_MINT) {
        let batchedJob: number[] = [];

        rituals.forEach((count, ritual) => {
            for (let index = 0; index < count && batchedJob.length < MAX_RITUAL_MINT; index++) {
                batchedJob.push(ritual);
            }
        });
        
        const ritualResult = await connectedContract.batchConsumeRitualCharges(batchedJob,{gasLimit:5000000});
        if (ritualResult) {
            console.log(`Successful ritual ${ritualResult.hash}`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        // Update the counts in the map after the batch job
        batchedJob.forEach(ritual => {
            rituals.set(ritual, rituals.get(ritual)! - batchedJob.filter(number => number === ritual).length);
        });

        totalRituals = Array.from(rituals.values()).reduce((acc, count) => acc + count, 0);
        console.log(`total end loop rituals ${totalRituals}`)
    }
}

async function claimAndRestake(signer: ethers.Wallet, connectedContract: ethers.Contract) {
    const result = await forgeContract.getStakedShadowcornsByUser(signer.address, 0);
    for (const tokenId of result.stakedShadowcorns) {
        const stakingDetails = await forgeContract.getStakingDetails(tokenId);
        //console.log(`ready to harvest ${tokenId} time ${stakingDetails.timeToReachCap}`)
        if (stakingDetails.timeToReachCap === 0n) {
            //console.log(`ready to harvest ${tokenId}`)
            const tx = await connectedContract.harvestAndRestake(tokenId,{gasLimit:300000});
            console.log(`Shadowcorn ${tokenId} harvested and restaked ${tx.hash}`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

async function claimDailyRewards() {
    if(!process.env.PRIVATE_KEY ){
        console.log("add a private key to the .env file")
        return
    }
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
    const connectedContract = <ethers.Contract>forgeContract.connect(signer)

    const rewardsResult = await forgeContract.getPlayerRewards(signer.address)
    //console.log(`Unim is ${rewardsResult.rewardUNIM} and darkmarks ${rewardsResult.rewardDarkMarks}`)
    if(rewardsResult.rewardUNIM > 0 && rewardsResult.rewardDarkMarks > 0 ){
        const claimedResult = await connectedContract.claimRewards({gasLimit:300000})
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log(`successfully claimed ${rewardsResult.rewardUNIM} Unim and ${rewardsResult.rewardDarkMarks} Dark Marks claimedResults ${claimedResult.hash}`)
    }else{
        console.log('No rewards to claim today, hopefully tomorrow')
    }
}

async function start(){
    await claimDailyRewards()
    await enterTheDarKForest()
}

start()

