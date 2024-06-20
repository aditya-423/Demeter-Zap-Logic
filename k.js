require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");

const pool_abi = require('./abis/usds_usdc_pool_abi.json');
const farm_abi = require('./abis/usds_usdc_farm_abi.json');
const addr = "0x9dc903fe57e53441fd3e0ce8ccbea28c1725ab3d";
const addr1 = "0xf6ee4989d8e6b7c316e10cce7a3e6d596f3a5f3c";
const poolContract = new ethers.Contract(addr, pool_abi, provider);
const farmContract = new ethers.Contract(addr1, farm_abi, provider);

async function helper(k) {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    let p = ((Number(sqrtPriceX96) / (2 ** 96)) ** 2)/(10 ** 12);
    
    const tickLowerAllowed = await farmContract.tickLowerAllowed();
    const tickUpperAllowed = await farmContract.tickUpperAllowed();
    //console.log(tickLowerAllowed+"    "+tickUpperAllowed);

    // Calculate min and max prices based on ticks
    const pa = (1.0001 ** Number(tickLowerAllowed))/(10 ** 12);
    const pb = (1.0001 ** Number(tickUpperAllowed))/(10 ** 12);

    /*console.log("Current Price = "+p);
    console.log("Lower Limit Price = "+pa);
    console.log("Upper Limit Price = "+pb);*/

    const px=p;
    const py=1;

    //Suppose the user comes and provides usdc_amt USDC for zapping
    const usdc_amt = 100;
    let C = usdc_amt*p;
    let a0=usdc_amt;
    let a1=0;
    //Pre-calculating the number of tokens required
    let delY = (C*((p**0.5)-(pa**0.5)))/((px*((p**-0.5)-(pb**-0.5)))+(py*((p**0.5)-(pa**0.5))));
    let delX = (C - (delY*py))/px;
    
    delY = k*delY;

    let x = 100101;
    let y = 106658; 

    let xdep = delY/p;
    a0-=xdep;
    a1+=delY;
    x+=xdep;
    y-=delY;
    /*console.log("x new = "+x);
    console.log("y new = "+y);*/
    console.log("UDSC we have is "+a0+" USDS we have is "+a1);

    const temp = (((pa*pb)**0.5)*x)-y;
    const sqrtP_new = (temp + Math.sqrt((temp**2)+(4*x*y*pb)))/(2*x*(Math.sqrt(pb)));
    delX = delY/(sqrtP_new-Math.sqrt(pa))*((1/sqrtP_new)-(1/Math.sqrt(pb)));

    console.log("UDSC we need to deposit is "+delX+" USDS we need to deposit is "+delY);

    return((a0-delX)/usdc_amt);

}

(async () =>{

    let lo=0,hi=1,count=1,k=0;
    while(hi-lo > 0.0001 && count<=1000){
        count++;
        k=(hi+lo)/2;
        console.log("Checking for k = "+k);
        let dustX = await helper(k);
        if(dustX<0 || dustX>0.01) lo=k;
        else hi=k;
    }

    k=(lo+hi)/2;
    console.log("Optimal k = "+k);
    let finalDust = await helper(k);
    console.log("Percent Dust in X = "+ (finalDust*100) + "%");

})();
