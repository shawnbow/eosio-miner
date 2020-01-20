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
const node_fetch_1 = __importDefault(require("node-fetch"));
const util_1 = require("util");
const eosjs_1 = require("eosjs");
class EosClient {
    constructor(params) {
        const { endpoint, signatureProvider } = params;
        let url = "";
        if (endpoint && endpoint.match(/(https?):[/]{2}([^:]*)(?::([\d]+))?/)) {
            url = endpoint;
        }
        else {
            url = EosClient.getRandomEndpoint();
        }
        const rpc = new eosjs_1.JsonRpc(url, { fetch: node_fetch_1.default });
        const api = signatureProvider === undefined ? undefined : new eosjs_1.Api({
            rpc,
            signatureProvider,
            textDecoder: new util_1.TextDecoder(),
            textEncoder: new util_1.TextEncoder(),
        });
        this._client = { rpc, api };
    }
    getRpc() {
        return this._client.rpc;
    }
    getApi() {
        return this._client.api;
    }
    getAccount(account) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.getRpc().get_account(account);
            }
            catch (e) {
                console.error(e.toString());
                return null;
            }
        });
    }
    getBalance(code, account, symbol) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const balanceInfo = yield this.getRpc().get_currency_balance(code, account, symbol);
                if (balanceInfo.length <= 0)
                    return { balance: 0 };
                return {
                    balance: parseFloat(balanceInfo[0].split(' ')[0]),
                    precision: balanceInfo[0].split(' ')[0].split(".")[1].length,
                };
            }
            catch (e) {
                console.error(e.toString());
                return {
                    balance: 0,
                };
            }
        });
    }
    getTableRows(code, scope, table, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {
                code,
                scope,
                table,
                index_position: opts.index,
                key_type: opts.keyType,
                json: true
            };
            if (opts.lower) {
                params.lower_bound = opts.lower;
            }
            if (opts.upper) {
                params.upper_bound = opts.upper;
            }
            if (opts.limit) {
                params.limit = opts.limit;
            }
            try {
                const result = yield this.getRpc().get_table_rows(params);
                return result.rows;
            }
            catch (e) {
                console.error(e.toString());
                return [];
            }
        });
    }
    pushTransaction(actions, tx_opts, push_opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.getApi() === undefined) {
                console.error("eos api undefined");
                return false;
            }
            try {
                yield this.getApi().transact(Object.assign(Object.assign({}, tx_opts), { actions: actions }), Object.assign({ blocksBehind: 3, expireSeconds: 300 }, push_opts));
                return true;
            }
            catch (e) {
                console.error(e.json.error.code + '-' + e.json.error.name + '-' + e.json.error.what);
                return false;
            }
        });
    }
    transfer(from, to, quantity, memo, code, auths) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pushTransaction(EosClient.generteTransferActions(from, to, quantity, memo, code, auths, 1));
        });
    }
    sellram(from, bytes, auths) {
        return __awaiter(this, void 0, void 0, function* () {
            const action = {
                account: 'eosio',
                name: 'sellram',
                authorization: auths,
                data: {
                    account: from,
                    bytes: bytes,
                },
            };
            return yield this.pushTransaction([action]);
        });
    }
    undelegatebw(from, receiver, unstake_net_quantity, unstake_cpu_quantity, auths) {
        return __awaiter(this, void 0, void 0, function* () {
            const action = {
                account: 'eosio',
                name: 'undelegatebw',
                authorization: auths,
                data: {
                    from,
                    receiver,
                    unstake_net_quantity,
                    unstake_cpu_quantity,
                },
            };
            return yield this.pushTransaction([action]);
        });
    }
}
exports.EosClient = EosClient;
EosClient.ENDPOINTS = [
    "http://node.eosflare.io",
    "https://node.eosflare.io",
    "http://eos.eoscafeblock.com",
    "https://eos.eoscafeblock.com",
    "http://api-mainnet.starteos.io",
    "https://api-mainnet.starteos.io",
    "http://eos.infstones.io",
    "https://eos.infstones.io",
    "https://api.zbeos.com",
    "https://node1.zbeos.com",
    "http://eos.greymass.com",
    "https://eos.greymass.com",
    "http://peer1.eoshuobipool.com:8181",
    "http://peer2.eoshuobipool.com:8181",
    "https://api.eosrio.io",
    "http://api.main.alohaeos.com",
    "https://api.main.alohaeos.com",
    "https://eosbp.atticlab.net",
    "https://api.redpacketeos.com",
    "http://mainnet.eos.dfuse.io",
    'https://mainnet.eos.dfuse.io',
    "https://eospush.tokenpocket.pro",
    "https://api.eosn.io",
    "http://openapi.eos.ren",
    "https://mainnet.meet.one",
    "https://nodes.get-scatter.com",
    "https://api1.eosasia.one",
    "https://mainnet-tw.meet.one",
    'https://api.eosdetroit.io',
    "http://eos.newdex.one",
    "https://eos.newdex.one",
    "https://api.eosnewyork.io",
    "https://api.eossweden.se",
    "https://api.eossweden.org",
    "https://mainnet.eoscannon.io",
    "https://api.helloeos.com.cn",
    "https://mainnet.eoscanada.com",
    "https://api.eoslaomao.com",
];
EosClient.getRandomEndpoint = () => {
    const index = Math.floor(Math.random() * EosClient.ENDPOINTS.length);
    return EosClient.ENDPOINTS[index];
};
EosClient.generteTransferActions = (from, to, quantity, memo, code, auths, num = 1) => {
    return Array(num).fill({
        account: code,
        name: 'transfer',
        authorization: auths,
        data: {
            from,
            to,
            quantity,
            memo,
        },
    });
};
