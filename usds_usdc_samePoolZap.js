require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");

const pool_abi = require('./abis/usds_usdc_pool_abi.json');
const farm_abi = require('./abis/usds_usdc_farm_abi.json');
const addr = "0x9dc903fe57e53441fd3e0ce8ccbea28c1725ab3d";
const addr1 = "0xf6ee4989d8e6b7c316e10cce7a3e6d596f3a5f3c";
const poolContract = new ethers.Contract(addr, pool_abi, provider);
const farmContract = new ethers.Contract(addr1, farm_abi, provider);

async function to_q96(x){
    for(let i=0;i<96;i++){
        x*=2;
    }
    return x;
}

async function to_num(x){
    for(let i=0;i<96;i++){
        x/=2;
    }
    return x;
}

const q96 = 2n ** 96n;

async function price_to_sqrtp(p) {
    const sqrtP = Math.sqrt(p);  // Calculate the square root of p
    const sqrtPBigInt = BigInt(Math.floor(sqrtP * Number(q96)));  // Convert to BigInt after scaling
    
    return sqrtPBigInt;
}

async function liquidity0(amount, pa, pb) {
    if (pa > pb) {
        [pa, pb] = [pb, pa];
    }

    const amountBigInt = BigInt(Math.floor(amount));

    // No need to convert pa and pb to floating-point numbers, as they are already BigInt

    // Calculate the intermediate result
    const intermediate = amountBigInt * (pa * pb) / q96;

    // Return the result
    return intermediate / (pb - pa);
}

async function liquidity1(amount, pa, pb) {
    if (pa > pb) {
        [pa, pb] = [pb, pa];
    }

    const amountBigInt = BigInt(Math.floor(amount));

    // Calculate the result directly in BigInt
    const resultBigInt = amountBigInt * q96 / (pb - pa);

    // Return the result
    return resultBigInt;
}

async function calcAmount0(liq, pa, pb) {
    if (pa > pb) {
        [pa, pb] = [pb, pa];
    }

    const liqBigInt = BigInt(liq);
    
    // Calculate the intermediate result
    const intermediate = liqBigInt * q96 * BigInt(pb - pa) / (pa * pb);
    
    // Return the result as a JavaScript number
    return Number(intermediate);
}

async function calcAmount1(liq, pa, pb) {
    if (pa > pb) {
        [pa, pb] = [pb, pa];
    }

    const liqBigInt = BigInt(liq);
    
    // Calculate the intermediate result
    const intermediate = liqBigInt * BigInt(pb - pa) / q96;
    
    // Return the result as a JavaScript number
    return Number(intermediate);
}


(async () =>{

    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const p = ((Number(sqrtPriceX96) / (2 ** 96)) ** 2)/(10 ** 12);
    
    const tickLowerAllowed = await farmContract.tickLowerAllowed();
    const tickUpperAllowed = await farmContract.tickUpperAllowed();
    console.log(tickLowerAllowed+"    "+tickUpperAllowed);

    // Calculate min and max prices based on ticks
    const pa = (1.0001 ** Number(tickLowerAllowed))/(10 ** 12);
    const pb = (1.0001 ** Number(tickUpperAllowed))/(10 ** 12);

    console.log("Current Price = "+p);
    console.log("Lower Limit Price = "+pa);
    console.log("Upper Limit Price = "+pb);

    const px=p;
    const py=1;

    //Suppose the user comes and provides 1000 USDC for zapping
    const C = 1000*p;
    //Pre-calculating the number of tokens required
    let delY = (C*((p**0.5)-(pa**0.5)))/((px*((p**-0.5)-(pb**-0.5)))+(py*((p**0.5)-(pa**0.5))));
    let delX = (C - (delY*py))/px;
    delY = 0.819*delY;
    console.log("After our precalculations, an LP can be created for the user with "+delX+" USDC and "+delY+" USDs tokens.");

    const x = 102452;
    const y = 104307;
    const L = (x*y) ** 0.5;
    const del_sqrtP = -delY/L;
    const sqrtP_new = ((p**0.5))+del_sqrtP;
    const x_depo = L*((sqrtP_new**-1)-(p**-0.5));
    console.log("USDC to be deposited="+x_depo);
    delX = 1000 - x_depo;
    console.log("After swapping for the whole of USDs required, we would be left with "+delX+" USDC and "+delY+" USDs tokens");
    console.log("Due to swapping, current price in the pool changes to "+(sqrtP_new**2));

    const sqrtp_low = BigInt(await price_to_sqrtp(pa));
    const sqrtp_cur = BigInt(await price_to_sqrtp(sqrtP_new**2));
    const sqrtp_upp = BigInt(await price_to_sqrtp(pb));

    const liq0 = await liquidity0(delX, sqrtp_cur, sqrtp_upp);
    const liq1 = await liquidity1(delY, sqrtp_cur, sqrtp_low);
    let liq=1;
    if(liq0<liq1) liq=liq0;
    else liq=liq1;

    const amount0 = await calcAmount0(liq, sqrtp_upp, sqrtp_cur);
    const amount1 = await calcAmount1(liq, sqrtp_low, sqrtp_cur);

    console.log("An LP can be created using "+amount0+" USDC and "+amount1+" USDs.");
    //console.log("Thus dust left will be "+(delY-amount1)+"USDs");

})();
