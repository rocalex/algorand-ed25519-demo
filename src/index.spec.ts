import assert from "assert";
import * as dotenv from "dotenv";
import * as ed from "@noble/ed25519";
import * as fs from "fs";
import algosdk, { Algodv2, Account, ABIContract } from "algosdk";
import { getAlgodClient, waitForTransaction } from "./utils";
import { createHash } from "crypto";

dotenv.config();

describe("Algorand offsig", function () {
    let privateKey: Uint8Array;
    let groupKey: Uint8Array;
    let algodClient: Algodv2;
    let sender: Account;
    let appId: number;
    let contract: ABIContract;
    let programHash: Uint8Array;
    const enc = new TextEncoder();

    before(async () => {
        privateKey = ed.utils.randomPrivateKey();
        groupKey = await ed.getPublicKey(privateKey);

        algodClient = getAlgodClient();
        sender = algosdk.mnemonicToSecretKey(process.env.SENDER_MN || "");
        appId = parseInt(process.env.APP_ID || "");
        programHash = algosdk.decodeAddress(
            process.env.PROGRAM_HASH || ""
        ).publicKey;

        const buff = fs.readFileSync(__dirname + "/../contract.json");

        contract = new algosdk.ABIContract(JSON.parse(buff.toString()));
    });

    it("verify in frontend", async () => {
        const message = enc.encode("test");
        const rawData = createHash("SHA256").update(message).digest();
        const data = new Uint8Array([
            ...enc.encode("ProgData"),
            ...programHash,
            ...rawData,
        ]);

        const signature = await ed.sign(data, privateKey);

        const isValid = await ed.verify(signature, data, groupKey);

        assert.ok(isValid == true);
    });

    it("verify in app", async () => {
        const message = enc.encode("test");
        const rawData = createHash("SHA256").update(message).digest();
        const data = new Uint8Array([
            ...enc.encode("ProgData"),
            ...programHash,
            ...rawData,
        ]);

        const signature = await ed.sign(data, privateKey);

        const isValid = await ed.verify(signature, data, groupKey);

        assert.ok(isValid == true);

        function getMethodByName(name: string): algosdk.ABIMethod {
            const m = contract.methods.find((mt: algosdk.ABIMethod) => {
                return mt.name == name;
            });
            if (m === undefined) throw Error("Method undefined: " + name);
            return m;
        }

        const params = await algodClient.getTransactionParams().do();
        const commonParams = {
            appID: appId,
            sender: sender.addr,
            suggestedParams: params,
            signer: algosdk.makeBasicAccountTransactionSigner(sender),
        };

        const comp = new algosdk.AtomicTransactionComposer();
        comp.addMethodCall({
            method: getMethodByName("verify"),
            methodArgs: [rawData, signature, groupKey],
            ...commonParams,
        });
        comp.addMethodCall({
            method: getMethodByName("idle"),
            methodArgs: [0],
            ...commonParams,
        });
        comp.addMethodCall({
            method: getMethodByName("idle"),
            methodArgs: [1],
            ...commonParams,
        });

        const results = await comp.execute(algodClient, 4)

        for (const result of results.methodResults) {
            console.log(result.txInfo?.logs)
        }
    });
});
