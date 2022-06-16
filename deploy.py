import os

import dotenv
from algosdk.future import transaction

from xpnet.account import Account
from xpnet.contracts import approval_program, clear_program
from xpnet.utils import fully_compile_contract, get_algod_client, wait_for_transaction


def main():
    dotenv_file = dotenv.find_dotenv()
    
    client = get_algod_client(
        os.environ.get("ALGOD_HOST"),
        os.environ.get("ALGOD_PORT"),
        os.environ.get("ALGOD_API_KEY")
    )
    sender = Account.from_mnemonic(os.environ.get("SENDER_MN"))
    a, ah = fully_compile_contract(client, approval_program())
    c, _ = fully_compile_contract(client, clear_program())

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
