import os

import dotenv

from xpnet.account import Account
from xpnet.operations import create_app
from xpnet.utils import get_algod_client


def main():
    dotenv_file = dotenv.find_dotenv()
    
    client = get_algod_client(
        os.environ.get("ALGOD_HOST"),
        os.environ.get("ALGOD_PORT"),
        os.environ.get("ALGOD_API_KEY")
    )
    sender = Account.from_mnemonic(os.environ.get("SENDER_MN"))
    app_id = create_app(client, sender)

    dotenv.set_key(dotenv_file, "APP_ID", str(app_id))


if __name__ == '__main__':
    dotenv.load_dotenv(".env")

    main()
