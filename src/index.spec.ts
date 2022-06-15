import assert from "assert";
import * as dotenv from "dotenv";
import * as ed from '@noble/ed25519'
import algosdk, { Algodv2, Account } from 'algosdk'
import { getAlgodClient, waitForTransaction } from "./utils";
import { createHash } from "crypto";

dotenv.config();

describe("Algorand offsig", function () {
    let privateKey: Uint8Array;
    let groupKey: Uint8Array;
    let algodClient: Algodv2;
    let sender: Account;
    const enc = new TextEncoder()

    before(async () => {
        privateKey = ed.utils.randomPrivateKey();
        groupKey = await ed.getPublicKey(privateKey);

        algodClient = getAlgodClient();
        sender = algosdk.mnemonicToSecretKey(process.env.SENDER_MN || "")
    })

    it("verify in frontend", async () => {
        const message = enc.encode("test")
        const rawData = createHash("SHA256").update(message).digest();;
        const programHash = algosdk.decodeAddress("HSIHEIDTLZO5ZTEGVYLS5YASJKXCN52JK24BQ3QI7QZ3GR5JILTZ7ZM3MM")
        const data = new Uint8Array([...enc.encode("ProgData"), ...programHash.publicKey, ...rawData])

        const signature = await ed.sign(data, privateKey)

        const isValid = await ed.verify(signature, data, groupKey)

        assert.ok(isValid == true)
    });

    it("verify in app", async () => {
        let appId = parseInt(process.env.APP_ID || "")

        const message = enc.encode("test")
        const rawData = createHash("SHA256").update(message).digest();
        const programHash = algosdk.decodeAddress("HSIHEIDTLZO5ZTEGVYLS5YASJKXCN52JK24BQ3QI7QZ3GR5JILTZ7ZM3MM")
        const data = new Uint8Array([...enc.encode("ProgData"), ...programHash.publicKey, ...rawData])

        const signature = await ed.sign(data, privateKey)

        const params = await algodClient.getTransactionParams().do()

        let txn = algosdk.makeApplicationNoOpTxnFromObject({
            from: sender.addr,
            suggestedParams: params,
            appIndex: appId,
            appArgs: [
                enc.encode("verify"),
                new Uint8Array([0]),
                new Uint8Array(rawData),
                signature,
                groupKey,
            ]
        })
        let txn2 = algosdk.makeApplicationNoOpTxnFromObject({
            from: sender.addr,
            suggestedParams: params,
            appIndex: appId,
            appArgs: [
                enc.encode("verify"),
                new Uint8Array([1]),
            ]
        })
        let txn3 = algosdk.makeApplicationNoOpTxnFromObject({
            from: sender.addr,
            suggestedParams: params,
            appIndex: appId,
            appArgs: [
                enc.encode("verify"),
                new Uint8Array([2]),
            ]
        })
        algosdk.assignGroupID([txn, txn2, txn3])

        const signedTxn = txn.signTxn(sender.sk)
        const signedTxn2 = txn2.signTxn(sender.sk)
        const signedTxn3 = txn3.signTxn(sender.sk)

        const { txId } = await algodClient.sendRawTransaction([signedTxn, signedTxn2, signedTxn3]).do()

        const res = await waitForTransaction(algodClient, txId)
        console.log(res.logs)
    })
});
