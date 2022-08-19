import os
import json

from pyteal import *


router = Router(
    "offsig-demo",
    BareCallActions(
        no_op=OnCompleteAction.create_only(Approve()),
        update_application=OnCompleteAction.call_only(Reject()),
        delete_application=OnCompleteAction.call_only(Reject()),
        close_out=OnCompleteAction.call_only(Reject()),
        opt_in=OnCompleteAction.call_only(Approve()),
        clear_state=OnCompleteAction.never()
    ),
)

@router.method
def verify(data: abi.String, sig: abi.String, pub_key: abi.String) -> Expr:
    opup = OpUp(OpUpMode.OnCall)
    return Seq(
        opup.ensure_budget(Int(2000)),
        Assert(Ed25519Verify(data.get(), sig.get(), pub_key.get())),
        Approve()
    )


if __name__ == '__main__':
    path = os.path.dirname(os.path.abspath(__file__))

    # we use compile program here to get the resulting teal code and Contract definition
    # similarly we could use build_program to return the AST for approval/clear and compile it
    # ourselves, but why?
    approval, clear, contract = router.compile_program(
        version=6, optimize=OptimizeOptions(scratch_slots=True)
    )

    # Dump out the contract as json that can be read in by any of the SDKs
    with open(os.path.join(path, "contract.json"), "w") as f:
        f.write(json.dumps(contract.dictify(), indent=2))

    # Write out the approval and clear programs
    with open(os.path.join(path, "approval.teal"), "w") as f:
        f.write(approval)

    with open(os.path.join(path, "clear.teal"), "w") as f:
        f.write(clear)
