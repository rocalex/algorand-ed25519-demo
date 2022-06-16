import json
import os

import dotenv
from algosdk.future import transaction
from pyteal import OptimizeOptions

from xpnet.account import Account
from xpnet.utils import fully_compile_contract, get_algod_client, wait_for_transaction
from xpnet.contracts import router


def main():
    path = os.path.dirname(os.path.abspath(__file__))
    
    dotenv_file = dotenv.find_dotenv()
    
    client = get_algod_client(
        os.environ.get("ALGOD_HOST"),
        os.environ.get("ALGOD_PORT"),
        os.environ.get("ALGOD_API_KEY")
    )
    sender = Account.from_mnemonic(os.environ.get("SENDER_MN"))
    
    approval, clear, contract = router.compile_program(
        version=6, optimize=OptimizeOptions(scratch_slots=True)
    )
    
    # Dump out the contract as json that can be read in by any of the SDKs
    with open(os.path.join(path, "contract.json"), "w") as f:
        f.write(json.dumps(contract.dictify(), indent=2))
    a, ah = fully_compile_contract(client, approval)
    c, _ = fully_compile_contract(client, clear)

    global_schema = transaction.StateSchema(num_uints=32, num_byte_slices=32)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    txn = transaction.ApplicationCreateTxn(
        sender=sender.get_address(),
        sp=client.suggested_params(),
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=a,
        clear_program=c,
        global_schema=global_schema,
        local_schema=local_schema,
    )
    signed_txn = txn.sign(sender.get_private_key())

    tx_id = client.send_transaction(signed_txn)

    response = wait_for_transaction(client, tx_id)
    assert response.application_index is not None and response.application_index > 0
    app_id = response.application_index

    dotenv.set_key(dotenv_file, "APP_ID", str(app_id))
    dotenv.set_key(dotenv_file, "PROGRAM_HASH", ah)


if __name__ == '__main__':
    dotenv.load_dotenv(".env")

    main()
