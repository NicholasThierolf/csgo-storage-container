const inquirer = require("inquirer");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const SteamCommunity = require("steamcommunity");
const communityUser = new SteamCommunity();

let user = new SteamUser();
let csgo, username, password, code;
let initialized = false;

async function logIntoAccount() {
  console.log(">> You need to log into your account!");

  let { username, password, code } = await inquirer.prompt([
    {
      name: "username",
      message: "Username: ",
    },
    {
      name: "password",
      type: "password",
      message: "Password: ",
    },
    {
      name: "code",
      message: "Current Steam Guard code: ",
    },
  ]);

  user.logOn({
    accountName: username,
    password,
    twoFactorCode: code,
  });
}

user.on("loggedOn", async (details, parental) => {
  if (initialized) return;
  initialized = true;
  csgo = new GlobalOffensive(user);
  initializedCSGO();
  user.gamesPlayed([730]);
});

function initializedCSGO() {
  csgo.on("connectedToGC", () => {
    console.log(">> Logged into your account!");
    startPacking();
  });
}

async function startPacking() {
  let inventory = csgo.inventory;
  let containers = [];
  let items = {};

  let assets = await getInventory(user.steamID);

  inventory.forEach((item) => {
    if (item.def_index == 1201) containers.push(item);
  });

  assets.forEach((item) => {
    if (items[item.classid] !== undefined) {
      items[item.classid].amount += 1;
      items[item.classid].ids.push(item.id);
    } else {
      items[item.classid] = {
        amount: 1,
        ids: [item.id],
        classid: item.classid,
      };
    }
  });

  let itemsArray = [];

  Object.keys(items).forEach((key) => {
    itemsArray.push({ classid: key });
  });

  let descriptions = await getAssetClassInfo(itemsArray);
  let itemNames = [];

  descriptions.forEach((description) => {
    Object.keys(items).forEach((key) => {
      if (key == description.classid) {
        items[key].name = description.market_hash_name;

        if (items[key].amount > 10) {
          itemNames.push(description.market_hash_name);
        }
      }
    });
  });

  /*
  let index = readlineSync.keyInSelect(
    itemNames,
    "Which Item do you want to Pack up?"
  );
  let itemName = itemNames[index];
*/
  let containerNames = containers.map((container) => container.custom_name);
  let { chosenItem, containerName } = await inquirer.prompt([
    {
      type: "list",
      name: "chosenItem",
      message: "Which Item do you want to Pack up?",
      loop: false,
      choices: Object.keys(items)
        .map((key) => {
          return {
            value: items[key],
            name: `${items[key].name} (${items[key].amount})`,
          };
        })
        .sort((a, b) => {
          return b.value.amount - a.value.amount;
        }),
    },
    {
      type: "list",
      name: "containerName",
      message: "Which container do you want to put the items into?",
      loop: false,
      choices: containerNames,
    },
  ]);

  let chosenContainer;
  containers.forEach((container) => {
    if (container.custom_name == containerName) {
      chosenContainer = container;
    }
  });
  let amount = await chooseAmount(chosenContainer, chosenItem);

  csgo.on("itemRemoved", (item) => {
    if (item.id in casketPromises) {
      const fn = casketPromises[item.id].resolve;
      delete casketPromises[item.id];
      fn();
    }
  });

  const casketItems = chosenItem.ids.slice(0, amount);
  await casketItems.reduce(
    (promiseChain, item) =>
      promiseChain.then(() => addToCasket(chosenContainer.id, item)),
    Promise.resolve()
  );

  console.log(
    ">> Everything has been tightly packed into the container of your choice!"
  );
  let { repeat } = await inquirer.prompt({
    name: "repeat",
    type: "boolean",
    message: "Do you want to store more items? ",
  });
  if (repeat) startPacking();
  else process.exit(0);
}

const casketPromises = {};
function addToCasket(container, item) {
  csgo.addToCasket(container, item);
  let p = new Promise((resolve, reject) => {
    casketPromises[item] = {
      resolve,
      reject,
    };
  });
  return p;
}

function chooseAmount(container, item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `The chosen container has ${
        1000 - container.casket_contained_item_count
      } free spaces`
    );
    let { amount } = await inquirer.prompt({
      name: "amount",
      type: "number",
      message: `How many of the ${item.amount} ${item.name}s do you want to store? `,
    });

    if (
      amount > item.amount ||
      amount > 1000 - container.casket_contained_item_count ||
      amount < 1
    ) {
      console.log("You can't store that many items!");
      amount = await chooseAmount(container, item);
      resolve(amount);
    } else {
      resolve(amount);
    }
  });
}

function getInventory(steamid) {
  return new Promise((resolve, reject) => {
    communityUser.getUserInventoryContents(
      steamid,
      730,
      2,
      false,
      (err, inventory) => {
        if (err) {
          reject();
          throw err;
        }

        resolve(inventory);
      }
    );
  });
}

function getAssetClassInfo(itemsArray) {
  return new Promise((resolve, reject) => {
    user.getAssetClassInfo("en", 730, itemsArray, (err, descriptions) => {
      if (err) {
        reject();
        return;
      }
      resolve(descriptions);
    });
  });
}

logIntoAccount();
