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

cron.schedule('4 * * * *', () => {
    console.log("Entering The Dark Forest")
    enterTheDarKForest();
});

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
                    console.log(`ready to harvest ${tokenId}`)
                    const tx = await connectedContract.harvestAndRestake(tokenId)
                    console.log(`harvest and restaked ${tx.hash}`)
                    await new Promise(resolve => setTimeout(resolve, 10000)) 
                }
            }
        }
        if(gasInGwei && gasInGwei < 50){
        
            const nebulaHusks = await itemsContract.balanceOf(signer.address,6)
            const soulHusks = await itemsContract.balanceOf(signer.address,5)
            const fireHusks = await itemsContract.balanceOf(signer.address,2)
            const nebulaRituals = Math.floor(Number(nebulaHusks)/50)
            const soulRituals = Math.floor(Number(soulHusks)/50)
            const fireRituals = Math.floor(Number(fireHusks)/50)
            const totalRituals = nebulaRituals + soulRituals + fireRituals
            //console.log(`husks soul: ${nebulaRituals}, nebula: ${soulRituals}, fire: ${fireRituals}, total of ${totalRituals} `)
            if(totalRituals >= 50){ 
                let batchedJob: number[] = []
                for (let index = 0;index < soulRituals && batchedJob.length < 50; index++){       
                    batchedJob.push(4); //soul
                }
                for (let index = 0;index < nebulaRituals && batchedJob.length < 50; index++){       
                    batchedJob.push(5); //nebula
                }
                for (let index = 0;index < fireRituals && batchedJob.length < 50; index++){       
                    batchedJob.push(1); //fire
                }
            
                const ritualResult = await connectedContract.batchConsumeRitualCharges(batchedJob)
                if(ritualResult){
                    console.log(`Successful ritual ${ritualResult.hash}`)
                    await new Promise(resolve => setTimeout(resolve, 10000)) 
                }
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
    enterTheDarKForest();
}

start()

