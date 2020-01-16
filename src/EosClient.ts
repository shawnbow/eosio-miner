import nodeFetch from 'node-fetch';
import { TextDecoder, TextEncoder } from 'util';
import {Api, JsonRpc} from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';

export interface ITokenDesc {
  code: string;
  symbol: string;
  precision: number;
}

export class EosClient {
  static readonly ENDPOINTS = [
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
    // 'https://api.eosbeijing.one',
  ];

  static readonly getRandomEndpoint = (): string => {
    const index = Math.floor(Math.random() * EosClient.ENDPOINTS.length);
    return EosClient.ENDPOINTS[index];
  }

  static readonly generteTransferActions = (from: string, to: string, quantity: string, memo: string, code: string, auths: Array<{actor:string, permission: string}>, num: number = 1): Array<any> => {
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
  }

  private _client: { rpc: JsonRpc, api: Api | undefined };

  constructor( params: {endpoint?: string, signatureProvider?: JsSignatureProvider} ) {
    const {endpoint, signatureProvider} = params;

    let url: string = "";
    if (endpoint && endpoint.match(/(https?):[/]{2}([^:]*)(?::([\d]+))?/)) {
      url = endpoint;      
    } else {
      url = EosClient.getRandomEndpoint();
    }

    const rpc = new JsonRpc(url, { fetch: nodeFetch as any });
    const api = signatureProvider === undefined ? undefined : new Api({
      rpc,
      signatureProvider,
      textDecoder: new TextDecoder(),
      textEncoder: new TextEncoder(),
    });
    this._client = {rpc, api};
  }

  getRpc() {
    return this._client.rpc;
  }

  getApi() {
    return this._client.api;
  }

  async getAccount (account: string): Promise<any> {
    try {
      return await this.getRpc().get_account(account);
    } catch (e) {
      console.error(e.toString());
      return null;
    }
  }

  async getBalance (code:string, account: string, symbol:string): Promise<{balance: number, precision?: number}> {
    try {
      const balanceInfo = await this.getRpc().get_currency_balance(code, account, symbol);
      if (balanceInfo.length <= 0) return { balance: 0 };
      return {
        balance: parseFloat(balanceInfo[0].split(' ')[0]),
        precision: balanceInfo[0].split(' ')[0].split(".")[1].length,
      }
    } catch (e) {
      console.error(e.toString());
      return {
        balance: 0,
      }
    }
  }

  async getTableRows(code: string, scope: string, table: string,
    opts: {
      lower?: string;
      upper?: string;
      limit?: number;
      index?: string;
      keyType?: string;
    } = {}
  ): Promise<any[]> {
    const params: any = {
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
      const result = await this.getRpc().get_table_rows(params);
      return result.rows;
    } catch (e) {
      console.error(e.toString());
      return [];
    }
  }
  
  async pushTransaction(actions: Array<any>, tx_opts?: any, push_opts?: any): Promise<boolean> {
    if (this.getApi() === undefined) {
      console.error("eos api undefined");
      return false;
    }

    try {
      await this.getApi().transact(
      {
        ...tx_opts,
        actions: actions,
      },
      {
        blocksBehind: 3,
        expireSeconds: 300,
        ...push_opts,
      });
      return true;
    } catch (e) {
      console.error(e.json.error.code + '-' + e.json.error.name + '-' + e.json.error.what);
      return false;
    }
  }

  async transfer(from: string, to: string, quantity: string, memo: string, code: string, auths: Array<{actor:string, permission: string}>): Promise<boolean> {
    return await this.pushTransaction(EosClient.generteTransferActions(from, to, quantity, memo, code, auths, 1));
  }

  async sellram(from: string, bytes: number, auths: Array<any>): Promise<boolean> {
    const action = {
      account: 'eosio',
      name: 'sellram',
      authorization: auths,
      data: {
        account: from,
        bytes: bytes,
      },
    };
    return await this.pushTransaction([action]);
  }

  async undelegatebw(from: string, receiver: string, unstake_net_quantity: string, unstake_cpu_quantity: string, auths: Array<any>): Promise<boolean> {
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
    return await this.pushTransaction([action]);
  }
}
