import algosdk, { Algodv2 } from "algosdk";

export function getAlgodClient() {
    if (process.env.NODE_ENV == 'development') {
        return new algosdk.Algodv2(process.env.ALGOD_API_KEY || "", process.env.ALGOD_HOST, process.env.ALGOD_PORT)
    } else {
        return new algosdk.Algodv2({
            'x-api-key': process.env.ALGOD_API_KEY || ""
        }, process.env.ALGOD_HOST, process.env.ALGOD_PORT)
    }
}

class PendingTxnResponse {
    poolError: string;
    txn: Record<string, any>;
    applicationIndex: number | undefined;
    assetIndex: number | undefined;
    closeRewards: number | undefined;
    closingAmount: number | undefined;
    confirmedRound: number | undefined;
    globalStateDelta: any;
    localStateDelta: any;
    receiverRewards: number | undefined;
    senderRewards: number | undefined;
    innerTxns: Array<any>;
    logs: any;

    constructor(response: Record<string, any>) {
        this.poolError = response['pool-error'];
        this.txn = response['txn'];

        this.applicationIndex = response['application-index'];
        this.assetIndex = response['asset-index'];
        this.closeRewards = response['closing-rewards'];
        this.closingAmount = response['closing-amount'];
        this.confirmedRound = response['confirmed-round'];
        this.globalStateDelta = response['global-state-delta'];
        this.localStateDelta = response['local-state-delta'];
        this.receiverRewards = response['receiver-rewards'];
        this.senderRewards = response['sender-rewards'];

        this.innerTxns = response['inner-txns'] ? response['inner-txns'] : [];
        this.logs = response['logs'] ? response['logs'] : [];
    }
}

export const waitForTransaction = async (
    algodClient: Algodv2,
    txId: string
) => {
    const lastStatus = await algodClient.status().do();
    if (lastStatus === undefined) {
        throw new Error('Unable to get node status');
    }

    let lastRound = lastStatus['last-round'];
    let pendingTxn = await algodClient.pendingTransactionInformation(txId).do();

    while (
        !(pendingTxn['confirmed-round'] && pendingTxn['confirmed-round'] > 0)
    ) {
        console.log('Waiting for confirmation...');
        lastRound += 1;
        await algodClient.statusAfterBlock(lastRound).do();
        pendingTxn = await algodClient.pendingTransactionInformation(txId).do();
        console.log(
            `Transaction ${txId} confirmed in round ${pendingTxn['confirmed-round']}.`
        );
    }

    return new PendingTxnResponse(pendingTxn);
};

export async function getBalances(algodClient: Algodv2, address: string) {
    const accountInfo = await algodClient.accountInformation(address).do()
    const balances: any = {
        '0': accountInfo["amount"]
    }
    const assets = accountInfo['assets']
    for (let i = 0; i < assets.length; i++) {
        const assetId = assets[i]["asset-id"]
        const assetAmt = assets[i]['amount']
        balances[assetId] = assetAmt
    }
    return balances
}

export async function getBalance(algodClient: Algodv2, address: string, assetId: number | bigint) {
    const balances = await getBalances(algodClient, address)
    return balances[assetId.toString()]
}

export async function isOptedInAsset(algodClient: Algodv2, addr: string, assetId: number) {
    const balances = await getBalances(algodClient, addr)
    return Object.keys(balances).includes(assetId.toString())
}

const decodeState = (stateArray: Array<any>) => {
    const state: any = {};
    stateArray.forEach((pair) => {
        const key = Buffer.from(pair['key'], 'base64');

        let value = pair['value'];
        const valueType = value['type'];
        if (valueType == 2) value = value['uint'];
        if (valueType == 1) value = Buffer.from(value['bytes']);
        state[key.toString()] = value;
    });

    return state;
};

export const getAppGlobalState = async (client: Algodv2, appId: number) => {
    const appInfo = await client.getApplicationByID(appId).do();
    if (appInfo['params']['global-state']) {
        return decodeState(appInfo['params']['global-state']);
    } else {
        return undefined
    }
};