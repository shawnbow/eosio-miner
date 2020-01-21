#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const eosio_helper_1 = require("eosio-helper");
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
const eos_endpoint_1 = __importDefault(require("eos-endpoint"));
function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
const { argv } = yargs_1.default.options({
    account: {
        description: 'Your EOS account',
        type: 'string',
        demandOption: true,
    },
    private_key: {
        description: 'Your private key',
        type: 'string',
        demandOption: true,
    },
    mine_type: {
        description: '<EIDOS|POW|MICH>',
        type: 'string',
        default: 'EIDOS',
        demandOption: true,
    },
    max_cpu_per_action: {
        description: 'Max cpu usage (µs) per action, default is 300 µs',
        type: 'number',
        default: 300,
        demandOption: true,
    },
    min_actions: {
        description: 'Min actions per transaction, default is 32',
        type: 'number',
        default: 32,
        demandOption: true,
    },
    max_actions: {
        description: 'Max actions per transaction, default is 256',
        type: 'number',
        default: 256,
        demandOption: true,
    },
}).check(function (argv) {
    if (argv.mine_type !== 'EIDOS' && argv.mine_type !== 'POW' && argv.mine_type !== "MICH") {
        throw new Error('Error: mine_type is invalid!');
    }
    return true;
});
const account = argv.account;
const private_key = argv.private_key;
const MAX_CPU_PER_ACTION = argv.max_cpu_per_action;
const MIN_ACTIONS = argv.min_actions;
const MAX_ACTIONS = argv.max_actions;
const eos_token = {
    code: "eosio.token",
    symbol: "EOS",
    precision: 4,
};
const mine_token = ((symbol) => {
    switch (symbol) {
        case 'EIDOS':
            return {
                code: 'eidosonecoin',
                symbol,
                precision: 4,
            };
        case 'POW':
            return {
                code: 'eosiopowcoin',
                symbol,
                precision: 8,
            };
        case 'MICH':
            return {
                code: 'mine4charity',
                symbol,
                precision: 4,
            };
        default:
            throw new Error('Error: mine_type is invalid!');
    }
})(argv.mine_type);
exports.g = {
    clients: eosio_helper_1.EosClient.ENDPOINTS.map(endpoint => new eosio_helper_1.EosClient({ endpoint, private_keys: [private_key] })),
    pause_mine_once: false,
    num_actions: MAX_ACTIONS,
};
function get_client() {
    return exports.g.clients[Math.floor(Math.random() * exports.g.clients.length)];
}
function refresh_clients() {
    return __awaiter(this, void 0, void 0, function* () {
        const newpoints = yield eos_endpoint_1.default();
        const allpoints = Array.from(new Set([...eosio_helper_1.EosClient.ENDPOINTS, ...(newpoints.map(({ url }) => url))]));
        exports.g.clients = allpoints.map((endpoint) => new eosio_helper_1.EosClient({ endpoint, private_keys: [private_key] }));
    });
}
function get_cpu_info(account, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const info = yield client.getAccount(account);
        if (info) {
            return {
                max: info.cpu_limit.max,
                available: info.cpu_limit.available,
                used: info.cpu_limit.used,
            };
        }
        else {
            return {
                max: 0,
                available: 0,
                used: 0,
            };
        }
    });
}
function check_cpu() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = get_client();
            const cpu_info = yield get_cpu_info(account, client);
            const more_num = MIN_ACTIONS * Math.ceil((cpu_info.available + 1) / MAX_CPU_PER_ACTION / MIN_ACTIONS);
            exports.g.num_actions = Math.min(more_num, MAX_ACTIONS);
            console.info(chalk_1.default.blue(`check_cpu: cpu_available=${cpu_info.available} set num_actions=${exports.g.num_actions}`));
        }
        catch (e) {
            console.error(e.toString());
        }
    });
}
function mine() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (exports.g.pause_mine_once) {
                exports.g.pause_mine_once = false;
                return;
            }
            const client = get_client();
            // get pre mine balance
            const { balance: pre_mine_balance } = yield client.getBalance(mine_token.code, account, mine_token.symbol);
            // apply mine
            const actions = eosio_helper_1.EosClient.generteTransferActions(account, mine_token.code, "0.0001 EOS", "", eos_token.code, [
                {
                    actor: account,
                    permission: "active",
                },
            ], exports.g.num_actions);
            const max_cpu_usage_ms = Math.ceil(MAX_CPU_PER_ACTION * exports.g.num_actions / 1000);
            console.info(chalk_1.default.blue(`mine: num_actions=${exports.g.num_actions}, max_cpu_usage_ms=${max_cpu_usage_ms}`));
            exports.g.pause_mine_once = !(yield client.pushTransaction(actions, { max_cpu_usage_ms }));
            if (exports.g.pause_mine_once) {
                exports.g.num_actions = Math.max(exports.g.num_actions - MIN_ACTIONS, MIN_ACTIONS);
                console.warn(chalk_1.default.yellow(`pause_mine_once: set num_actions=${exports.g.num_actions}`));
                return;
            }
            // get post mine balance
            const { balance: post_mine_balance } = yield client.getBalance(mine_token.code, account, mine_token.symbol);
            if (post_mine_balance > pre_mine_balance) {
                console.info(chalk_1.default.green(`Mined ${(post_mine_balance - pre_mine_balance).toFixed(mine_token.precision)} ${mine_token.symbol}!`));
            }
        }
        catch (e) {
            console.error(chalk_1.default.red(e.toString()));
        }
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.info(chalk_1.default.green(figlet_1.default.textSync(`${mine_token.symbol}  Miner`)));
    console.info(`min_actons=${MIN_ACTIONS}, max_actions=${MAX_ACTIONS}, max_cpu_per_action=${MAX_CPU_PER_ACTION}us`);
    const client = get_client();
    const { balance: eos_balance } = yield client.getBalance(eos_token.code, account, eos_token.symbol);
    console.info(`${eos_token.symbol} balance: ${eos_balance}`);
    const { balance: mine_balance } = yield client.getBalance(mine_token.code, account, mine_token.symbol);
    console.info(`${mine_token.symbol} balance: ${mine_balance}`);
    if (eos_balance < 0.01) {
        console.error('Your EOS balance is too low, must be greater than 0.01 EOS, please deposit more EOS to your account.');
        return;
    }
    setInterval(mine, 3 * 1000); // mine per 3s
    setInterval(check_cpu, 60 * 1000); // check cpu per 1mins
    setInterval(refresh_clients, 60 * 60 * 1000); // refresh clients per 60mins
}))();
//# sourceMappingURL=index.js.map