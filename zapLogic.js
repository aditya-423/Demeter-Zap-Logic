require("dotenv").config();
const { ethers } = require("ethers");
const axios = require('axios');
const readline = require('readline');
const fetch = require("node-fetch");
const { exec } = require("child_process");


const choices = {
    1: 'sperax',
    2: 'sperax-usd',
    3: 'usd-coin',
    4: 'weth',
    5: 'tether',
    6: 'dai'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");


function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function getSelection() {
    let selectionIn = 0;
    let i = 1;

    for (let choice in choices) {
        console.log(`${i} -> ${choices[choice]}`);
        i++;
    }

    while (true) {
        const input = await askQuestion('Please enter the token you want to zap with into the SPA-USDs farm\n');
        selectionIn = parseInt(input, 10);
        if (selectionIn >= 1 && selectionIn <= 6 && !isNaN(selectionIn)) {
            console.log('Loading token for you.');
            return selectionIn;
        } else {
            console.log('\n\nInvalid choice: Please enter a number between 1 to 6\n');
        }
    }
}


async function getNumberOfTokens() {
    while (true) {
        const input = await askQuestion('Please enter the number of zap tokens\n');
        const numberOfTokens = parseFloat(input);
        if (numberOfTokens > 0 && !isNaN(numberOfTokens)) {
            console.log(`You have chosen to zap ${numberOfTokens} tokens.`);
            return numberOfTokens;
        } else {
            console.log('\n\nInvalid choice: Please enter a positive number\n');
        }
    }
}

async function getPrice(token){
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${choices[token]}&vs_currencies=usd`;
    const options = {method: 'GET', headers: {accept: 'application/json'}};

    /*const priceData = fetch(url, options)
                        .then(res => res.json())
                        .then(json => console.log(json))
                        .catch(err => console.error('error:' + err));

    return priceData[zapToken].usd;*/

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log(data);
        return data[choices[token]].usd;
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}


(async () => {
    const zapToken = await getSelection();
    const numberOfTokens = await getNumberOfTokens();
    let C = await getPrice(zapToken);
    C*=numberOfTokens;
    console.log(`Selected token: ${choices[zapToken]}`);
    console.log(`Number of zap tokens: ${numberOfTokens}`);
    console.log('Total Value In in USD: $'+ C);
    rl.close();

    
    const aggregatorV3InterfaceABI = require('./abis/feed.json');
    const aggregatorV3InterfaceABI1 = require('./abis/feed1.json');
    const aggregator1inchV6ABI = require('./abis/1inchaggregationrouterV6.json');
    const addr = "0xeBc45B3b23A3Bae76270A51f7196e55Cba843CAB";
    const addr1 = "0x08e0b47588e1aC22Bc0f8B4afAa017aAf273f85e";
    const oneInchAddr = "0x111111125421ca6dc452d289314280a0f8842a65";
    

    const farmContract = new ethers.Contract(addr, aggregatorV3InterfaceABI, provider);
    const poolContract = new ethers.Contract(addr1, aggregatorV3InterfaceABI1, provider);
    const oneInchRouter = new ethers.Contract(oneInchAddr, aggregator1inchV6ABI, provider);
    
    const tickLowerAllowed = await farmContract.tickLowerAllowed();
    const tickUpperAllowed = await farmContract.tickUpperAllowed();

    // Calculate min and max prices based on ticks
    const pa = 1.0001 ** Number(tickLowerAllowed);
    const pb = 1.0001 ** Number(tickUpperAllowed);
    
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    // Calculate the current price from sqrtPriceX96
    const p = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;

    const px = await getPrice(1);
    const py = await getPrice(2);
    

    console.log(`Min Price: ${pa}`);
    console.log(`Max Price: ${pb}`);
    console.log(`Current Price: ${p}`);


    const delY = (C*((p**0.5)-(pa**0.5)))/((px*((p**-0.5)-(pb**-0.5)))+(py*((p**0.5)-(pa**0.5))));
    const delX = (C - (delY*py))/px;

    console.log("You get "+delX+" SPA tokens and "+delY+" USDs tokens!");
})();
