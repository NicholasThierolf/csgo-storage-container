const inquirer = require("inquirer");
const SteamUser = require("steam-user");
const GlobalOffensive = require("globaloffensive");
const SteamCommunity = require("steamcommunity");
const communityUser = new SteamCommunity();
const cliProgress = require("cli-progress");

const { Loader } = require("./container-interfaces.js");
const { ItemNames } = require("./item-names.js");

let user = new SteamUser();
let csgo;
let initialized = false;

let itemNames = new ItemNames();

async function logIntoAccount() {
  await itemNames.init();
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
    mainMenu();
  });
}

async function structureInventory(inventory) {}

function getAllContainers() {
  let inventory = csgo.inventory;
  let containers = [];
  inventory.forEach((item) => {
    if (item.def_index == 1201) containers.push(item);
  });
  return containers;
}

async function unloadItemsMenu() {
  let containers = getAllContainers();

  let { container } = await inquirer.prompt([
    {
      type: "list",
      name: "container",
      message: "Which container do you want to get Items from?",
      loop: false,
      choices: containers.map((container) => {
        return {
          value: container.id,
          name: `${container.custom_name} (${container.casket_contained_item_count})`,
        };
      }),
    },
  ]);

  console.log("getting from", container, containers);

  let items = await getContainerItems(container);

  items.forEach((item) => {
    console.log(item);
  });
  //console.log(items);

  //item looks like (big pain):
  let item = {
    attribute: [[Object], [Object]],
    equipped_state: [],
    id: "17439912267",
    account_id: 158862006,
    inventory: 1,
    def_index: 4018,
    quantity: 1,
    level: 1,
    quality: 4,
    flags: 4,
    origin: 0,
    custom_name: null,
    custom_desc: null,
    interior_item: null,
    in_use: false,
    style: null,
    original_id: null,
    rarity: 1,
    position: 1,
    casket_id: "17260735851",
  };

  process.exit(0);
}

function getContainerItems(container) {
  return new Promise((resolve, reject) => {
    console.log("got here");
    csgo.getCasketContents(container, (err, items) => {
      console.log("got here again");
      if (err) {
        //todo: handle err
        console.log("got error :(");
        reject();
      } else {
        console.log("got to resolve", items);
        resolve(items);
      }
    });
  });
}

async function loadItemsMenu() {
  let containers = getAllContainers();
  let items = getInventory(); //{};

  //let assets = await getInventory(user.steamID);

  /*
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
  });*/

  let itemsArray = [];

  Object.keys(items).forEach((key) => {
    itemsArray.push({ classid: key });
  });

  //let descriptions = await getAssetClassInfo(itemsArray);

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

  let itemsToLoad = [];
  for (let i = 0; i < amount; i++) {
    itemsToLoad.push(chosenItem.ids[i]);
  }

  await loadItems(chosenContainer.id, itemsToLoad);

  console.log(
    ">> Everything has been tightly packed into the container of your choice!"
  );
  mainMenu();
}

function loadItems(container, items) {
  return new Promise((resolve, reject) => {
    let progressBar = new cliProgress.SingleBar(
      {
        clearOnComplete: true,
        format: "[{bar}] {value} of {total} items packed",
      },
      cliProgress.Presets.shades_classic
    );

    progressBar.start(items.length, 0);

    let loader = new Loader(csgo);

    loader.on("finished", () => {
      progressBar.stop();
      resolve();
    });

    loader.on("added", (totalLoaded) => {
      progressBar.update(totalLoaded);
    });
    loader.load(container, items);
  });
}

function chooseAmount(container, item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `>>The chosen container has ${
        1000 - container.casket_contained_item_count
      } free spaces`
    );
    let { amount } = await inquirer.prompt({
      name: "amount",
      type: "number",
      message: `How many of the ${item.amount} ${item.name}s do you want to store? (Enter nothing to store the max amount)`,
      default: Math.min(
        item.amount,
        1000 - container.casket_contained_item_count
      ),
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

function getInventory() {
  let inventory = csgo.inventory;
  let items = {};
  inventory.forEach((item) => {
    if (item.def_index !== 1201) {
      //console.log(item);
      let name = itemNames.nameItem(
        item.def_index,
        item.paint_wear,
        item.paint_index
      );
      if (name === false) return;
      if (items[name]) {
        items[name].ids.push(item.id);
        items[name].amount += 1;
      } else {
        items[name] = {
          name: name,
          ids: [item.id],
          amount: 1,
        };
      }
    }
  });
  return items;
}
/*
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
}*/

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

async function mainMenu() {
  let { choice } = await inquirer.prompt([
    {
      type: "list",
      name: "choice",
      message: "What do you want to do?",
      loop: false,
      choices: [
        { name: "Load Items into a storage container", value: "load" },
        { name: "Unload Items from a storage container", value: "unload" },
        { name: "Quit", value: "quit" },
      ],
    },
  ]);
  switch (choice) {
    case "load":
      loadItemsMenu();
      break;
    case "unload":
      unloadItemsMenu();
      break;
    case "quit":
      quit();
      break;
  }
}

function quit() {
  console.log(
    ">> Thank you for using this tool, feel free to give it a Star on Github <3"
  );
  process.exit(0);
}

logIntoAccount();
