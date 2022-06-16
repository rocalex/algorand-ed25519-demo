from pyteal import *


def approval_program():
    on_create = Seq(
        Approve()
    )

    data = Txn.application_args[1]
    sig = Txn.application_args[2]
    pub_key = Txn.application_args[3]
    on_verify = Seq(
        Assert(Ed25519Verify(data, sig, pub_key)),
        Approve()
    )
    
    on_idle = Seq(
        Approve()
    )

    on_call_method = Txn.application_args[0]
    on_call = Cond(
        [on_call_method == Bytes("verify"), on_verify],
        [on_call_method == Bytes("idle"), on_idle],
    )

    return Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.NoOp, on_call],
        [
            Txn.on_completion() == OnComplete.OptIn,
            Approve()
        ],
        [
            Or(
                Txn.on_completion() == OnComplete.UpdateApplication,
                Txn.on_completion() == OnComplete.DeleteApplication,
                Txn.on_completion() == OnComplete.CloseOut
            ),
            Reject()
        ]
    )


def clear_program():
    return Approve()


if __name__ == '__main__':
    with open("bridge_approval.teal", "w") as f:
        compiled = compileTeal(
            approval_program(),
            mode=Mode.Application, version=6
        )
        f.write(compiled)

    with open("bridge_clear.teal", "w") as f:
        compiled = compileTeal(
            clear_program(),
            mode=Mode.Application, version=6
        )
        f.write(compiled)
