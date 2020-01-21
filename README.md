# eosio-miner

EOSIO common miner supports EIDOS/POW/MICH, 1000 times faster than your phone!

## Start mining
    npx eosio-miner --account <your_eos_account> --private_key <your_private_key> --mine_type <EIDOS|POW|MICH>

## More parameters
    max_cpu_per_action: Max cpu usage (µs) per action
    min_actions: Min actions per transaction
    max_actions: Max actions per transaction, the miner use max_actions at start.

## Thanks to
    https://github.com/soulmachine/eidos-miner
