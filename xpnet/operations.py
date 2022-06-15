from typing import Tuple
from algosdk.future import transaction
from algosdk.v2client.algod import AlgodClient
from xpnet.contracts import approval_program, clear_program

from xpnet.utils import fully_compile_contract, wait_for_transaction

from .account import Account


def get_contracts(client: AlgodClient) -> Tuple[bytes, bytes]:
    a = fully_compile_contract(
        client, approval_program()
    )
    c = fully_compile_contract(
        client, clear_program()
    )

    return a, c


def create_app(client: AlgodClient, sender: Account):
    approval, clear = get_contracts(client)

    global_schema = transaction.StateSchema(num_uints=32, num_byte_slices=32)
    local_schema = transaction.StateSchema(num_uints=0, num_byte_slices=0)

    txn = transaction.ApplicationCreateTxn(
        sender=sender.get_address(),
        sp=client.suggested_params(),
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=global_schema,
        local_schema=local_schema,
    )
    signed_txn = txn.sign(sender.get_private_key())

    tx_id = client.send_transaction(signed_txn)

    response = wait_for_transaction(client, tx_id)
    assert response.application_index is not None and response.application_index > 0
    return response.application_index
