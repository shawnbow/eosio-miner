#!/usr/bin/env node
import yargs from 'yargs';
import { EosClient } from 'eosio-helper';
import chalk from 'chalk';
import figlet from 'figlet';
// import getApiEndpoints from 'eos-endpoint';

function sleep(milliseconds:number ) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const { argv } = yargs.options({
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
}).check(function(argv) {
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

interface ITokenDesc {
  code: string;
  symbol: string;
  precision: number;
}

const eos_token: ITokenDesc = {
  code: "eosio.token",
  symbol: "EOS",
  precision: 4,
}

const mine_token: ITokenDesc = ((symbol)=>{
  switch(symbol) {
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
      }
    default:
      throw new Error('Error: mine_type is invalid!');
  }
})(argv.mine_type);

let g = {
  clients: EosClient.ENDPOINTS.map(endpoint => new EosClient({endpoint, private_keys: [private_key]})),
  pause_mine_once: false,
  num_actions: MAX_ACTIONS,
};

function get_client(): EosClient {
  return g.clients[Math.floor(Math.random() * g.clients.length)];
}

async function get_cpu_info(account: string, client: EosClient): Promise<{ max: number, available:number, used: number }> {
  const info = await client.getAccount(account);
  if (info) {
    return {
      max: info.cpu_limit.max,
      available: info.cpu_limit.available,
      used: info.cpu_limit.used,
    }
  } else {
    return {
      max: 0,
      available: 0,
      used: 0,
    }
  }
}

async function check_cpu() {
  try {
    const client = get_client();
    const cpu_info = await get_cpu_info(account, client);
    const more_num = MIN_ACTIONS * Math.ceil((cpu_info.available + 1) / MAX_CPU_PER_ACTION / MIN_ACTIONS);
    g.num_actions = Math.min(more_num, MAX_ACTIONS);
    console.info(chalk.blue(`check_cpu: cpu_available=${cpu_info.available} set num_actions=${g.num_actions}`));
  } catch (e) {
    console.error(e.toString());
  }
}

async function mine() {
  try {
    if (g.pause_mine_once) {
      g.pause_mine_once = false;
      return;
    }

    const client = get_client();

    // get pre mine balance
    const { balance: pre_mine_balance } = await client.getBalance(mine_token.code, account, mine_token.symbol);

    // apply mine
    const actions = EosClient.makeActions(
      eos_token.code,
      'transfer',
      { from: account, to: mine_token.code, quantity: '0.0001 EOS', memo: ''},
      [
        {
          actor: account,
          permission: "active",
        },
      ],
      g.num_actions
    );
    const max_cpu_usage_ms = Math.ceil(MAX_CPU_PER_ACTION * g.num_actions / 1000);
    console.info(chalk.blue(`mine: num_actions=${g.num_actions}, max_cpu_usage_ms=${max_cpu_usage_ms}. endpoint:${client.getRpc().endpoint}`));
    g.pause_mine_once = !await client.pushTransaction(actions, { max_cpu_usage_ms } );
    if (g.pause_mine_once) {
      g.num_actions = Math.max(g.num_actions - MIN_ACTIONS, MIN_ACTIONS);
      console.warn(chalk.yellow(`pause_mine_once: set num_actions=${g.num_actions}`));
      return;
    }

    // get post mine balance
    const { balance: post_mine_balance } = await client.getBalance(mine_token.code, account, mine_token.symbol);
    if (post_mine_balance > pre_mine_balance) {
      console.info(chalk.green(`Mined ${(post_mine_balance - pre_mine_balance).toFixed(mine_token.precision)} ${mine_token.symbol}!`),
      );
    }
  } catch (e) {
    console.error(chalk.red(e.toString()));
  }
}

(async () => {
  console.info(chalk.green(figlet.textSync(`${mine_token.symbol}  Miner`)));
  console.info(`min_actons=${MIN_ACTIONS}, max_actions=${MAX_ACTIONS}, max_cpu_per_action=${MAX_CPU_PER_ACTION}us`);

  const client = get_client();
  const { balance: eos_balance } = await client.getBalance(eos_token.code, account, eos_token.symbol);
  console.info(`${eos_token.symbol} balance: ${eos_balance}`);

  const { balance: mine_balance } = await client.getBalance(mine_token.code, account, mine_token.symbol);
  console.info(`${mine_token.symbol} balance: ${mine_balance}`);

  if (eos_balance < 0.01) {
    console.error('Your EOS balance is too low, must be greater than 0.01 EOS, please deposit more EOS to your account.');
    return;
  }
  setInterval(mine, 2*1000); // mine per 2s
  setInterval(check_cpu, 60*1000); // check cpu per 1mins

  // setInterval(async () => {
  //   const newpoints = await getApiEndpoints();
  //   const allpoints = Array.from(new Set([...EosClient.ENDPOINTS, ...(newpoints.map(({url})=>url))]));
  //   g.clients = allpoints.map((endpoint) => new EosClient({endpoint, private_keys: [private_key]}));
  // }, 60*60*1000); // refresh clients per 60mins
})();