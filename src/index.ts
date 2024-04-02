import * as fs from 'fs';
import { ethers } from "ethers";
import * as cron from 'node-cron';

require("dotenv").config();

const rpc = 'https://polygon-mainnet.infura.io/v3/'+process.env.INFURA_API_KEY;
const provider = new ethers.JsonRpcProvider(rpc);
const shadowforgeAbi = JSON.parse(fs.readFileSync('abis/shadowforge.abi.json', 'utf8'))
const forgeContract = new ethers.Contract("0x94f84d94A1b8Ce60C5F99eAF89b4679bf9Bf598c", shadowforgeAbi, provider);
const shadowcornItemsAbi = JSON.parse(fs.readFileSync('abis/shadowcornItems.abi.json', 'utf8'))
const itemsContract = new ethers.Contract("0xb27bbc8f0092284a880d1616f184d86c1a640fae", shadowcornItemsAbi, provider);

const MAX_RITUAL_MINT = 50
const HUSKS_PER_RITUAL = 50


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
        const gasInGwei = await getGasInGwei()
        if(!process.env.PRIVATE_KEY ){
            console.log("add a private key to the .env file")
            return
        }
        const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
        const connectedContract = <ethers.Contract>forgeContract.connect(signer)

        if(gasInGwei && gasInGwei < 100){
            const result = await forgeContract.getStakedShadowcornsByUser(signer.address, 0)
            for(const tokenId of result.stakedShadowcorns){
                const stakingDetails = await forgeContract.getStakingDetails(tokenId)
                if(stakingDetails.timeToReachCap === 0n){
                    //console.log(`ready to harvest ${tokenId}`)
                    const tx = await connectedContract.harvestAndRestake(tokenId)
                    console.log(`Shadowcorn ${tokenId} harvested and restaked ${tx.hash}`)
                    await new Promise(resolve => setTimeout(resolve, 10000)) 
                }
            }
        }
        if(gasInGwei && gasInGwei < 50){
            const tokenArray = [2,3,4,5,6]
            const addressArray: string[] = []
            tokenArray.forEach(element => {
                addressArray.push(signer.address)
            });
            const huskBalanceResults = await itemsContract.balanceOfBatch(addressArray,tokenArray)
            if(!huskBalanceResults)
                return 

            const fireRituals = Math.floor(Number(huskBalanceResults[0])/HUSKS_PER_RITUAL)
            const slimeRituals = Math.floor(Number(huskBalanceResults[1])/HUSKS_PER_RITUAL)
            const voltRituals = Math.floor(Number(huskBalanceResults[2])/HUSKS_PER_RITUAL)
            const soulRituals = Math.floor(Number(huskBalanceResults[3])/HUSKS_PER_RITUAL)
            const nebulaRituals = Math.floor(Number(huskBalanceResults[4])/HUSKS_PER_RITUAL)
            let totalRituals = nebulaRituals + soulRituals + fireRituals + slimeRituals + voltRituals
            
            while(totalRituals >= MAX_RITUAL_MINT){ 
                let batchedJob: number[] = []
                for (let index = 0;index < soulRituals && batchedJob.length < MAX_RITUAL_MINT; index++){       
                    batchedJob.push(4); //soul ritual
                }
                for (let index = 0;index < nebulaRituals && batchedJob.length < MAX_RITUAL_MINT; index++){       
                    batchedJob.push(5); //nebula ritual
                }
                for (let index = 0;index < fireRituals && batchedJob.length < MAX_RITUAL_MINT; index++){       
                    batchedJob.push(1); //fire ritual
                }
                for (let index = 0;index < voltRituals && batchedJob.length < MAX_RITUAL_MINT; index++){       
                    batchedJob.push(3); //volt ritual
                }
                for (let index = 0;index < slimeRituals && batchedJob.length < MAX_RITUAL_MINT; index++){       
                    batchedJob.push(2); //slime ritual
                }
            
                const ritualResult = await connectedContract.batchConsumeRitualCharges(batchedJob)
                if(ritualResult){
                    console.log(`Successful ritual ${ritualResult.hash}`)
                    await new Promise(resolve => setTimeout(resolve, 10000)) 
                }
                totalRituals = totalRituals - batchedJob.length
            }
        }

    } catch (e: Error | any) {
        console.log(e)
        e.code && e.info && console.error(`⚠️ ${e.code} (${e.info.error.shortMessage})`)
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
        const claimedResult = await connectedContract.claimRewards()
        console.log(`successfully claimed ${rewardsResult.rewardUNIM} Unim and ${rewardsResult.rewardDarkMarks} Dark Marks claimedResults ${claimedResult.hash}`)
    }else{
        console.log('No rewards to claim today, hopefully tomorrow')
    }
}

async function getGasInGwei() {
    try{
        const feeData = await provider.getFeeData()

        let gasPrice = feeData.gasPrice;
        if(gasPrice){
            const gasPriceGwei = +ethers.formatUnits(gasPrice, 'gwei')
            console.log(`gas price ${gasPriceGwei}`)
            return gasPriceGwei
        }

    } catch (e: Error | any) {
        console.log(e)
        e.code && e.info && console.error(`⚠️ ${e.code} (${e.info.error.shortMessage})`)
    }
    
    
} 
async function start(){
    await claimDailyRewards()
    await enterTheDarKForest()
}

start()

