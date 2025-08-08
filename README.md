# trading-engine-workshop


## How to run the script
1. Install packages `yarn`
2. Fill out the `.env` as the format in `.env.example`
```
API_BASE_URL=(Node API Endpoint URL for the network you're sending the tx, e.g. `https://base-mainnet.g.alchemy.com/v2/(your_alchemy_key)`)
API_KEY=(This is the API Key for Gud Engine, for ETHVietnam, use: ETHVietnam2025)
PRIVATE_KEY=(your private key, with 0x prefix)
```
3. Modify `./scripts/trade.js`, modify the `QUOTE_REQUEST` so that the transaction you execute is what you intended.
4. execute `yarn node ./scripts/trade.js`