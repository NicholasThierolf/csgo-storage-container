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

  let items = await getContainerItems(container);

  let formatedItems = formatInventory(items);
  let { chosenItem } = await inquirer.prompt([
    {
      type: "list",
      name: "chosenItem",
      message: "Which Item do you want retrieve?",
      loop: false,
      choices: Object.keys(formatedItems)
        .map((key) => {
          return {
            value: formatedItems[key],
            name: `${key} (${formatedItems[key].amount})`,
          };
        })
        .sort((a, b) => {
          return b.value.amount - a.value.amount;
        }),
    },
  ]);

  let amount = await chooseUnloadAmount(chosenItem);

  let itemsToUnload = [];
  for (let i = 0; i < amount; i++) {
    itemsToUnload.push(chosenItem.ids[i]);
  }

  await moveItems(container, itemsToUnload, Loader.direction.unload);

  console.log(">> Everything has been unloaded out of the container!");
  mainMenu();
}

function getContainerItems(container) {
  return new Promise((resolve, reject) => {
    csgo.getCasketContents(container, (err, items) => {
      if (err) {
        //todo: handle err
        console.log("Something went wrong");
        reject();
      } else {
        resolve(items);
      }
    });
  });
}

async function loadItemsMenu() {
  let containers = getAllContainers();
  let items = getInventory();

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
  let amount = await chooseLoadAmount(chosenContainer, chosenItem);

  let itemsToLoad = [];
  for (let i = 0; i < amount; i++) {
    itemsToLoad.push(chosenItem.ids[i]);
  }

  await moveItems(chosenContainer.id, itemsToLoad, Loader.direction.load);

  console.log(
    ">> Everything has been tightly packed into the container of your choice!"
  );
  mainMenu();
}

function moveItems(container, items, direction) {
  return new Promise((resolve, reject) => {
    let directionText =
      direction === Loader.direction.load ? "packed" : "unpacked";
    let progressBar = new cliProgress.SingleBar(
      {
        clearOnComplete: true,
        format: `[{bar}] {value} of {total} items ${directionText}`,
      },
      cliProgress.Presets.shades_classic
    );

    progressBar.start(items.length, 0);

    let loader = new Loader(csgo);

    loader.on("finished", () => {
      progressBar.stop();
      resolve();
    });

    loader.on("moved", (totalLoaded) => {
      progressBar.update(totalLoaded);
    });
    loader.move(container, items, direction);
  });
}

function chooseUnloadAmount(item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `>> You have ${
        1000 - csgo.inventory.length
      } free spaces in your inventory`
    );
    let { amount } = await inquirer.prompt({
      name: "amount",
      type: "number",
      message: `How many of the ${item.amount} ${item.name}s do you want to unload?`,
      default: Math.min(item.amount, 1000 - csgo.inventory.length),
    });

    if (
      amount > item.amount ||
      amount > 1000 - csgo.inventory.length ||
      amount < 1
    ) {
      console.log("You can't unload that many items!");
      amount = await chooseUnloadAmount(item);
      resolve(amount);
    } else {
      resolve(amount);
    }
  });
}

function chooseLoadAmount(container, item) {
  return new Promise(async (resolve, reject) => {
    console.log(
      `>> The chosen container has ${
        1000 - container.casket_contained_item_count
      } free spaces`
    );
    let { amount } = await inquirer.prompt({
      name: "amount",
      type: "number",
      message: `How many of the ${item.amount} ${item.name}s do you want to store?`,
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
      amount = await chooseLoadAmount(container, item);
      resolve(amount);
    } else {
      resolve(amount);
    }
  });
}

function getInventory(fromCasket = false) {
  let inventory = csgo.inventory;
  return formatInventory(inventory, fromCasket);
}

function formatInventory(inventory, fromCasket) {
  let items = {};
  inventory.forEach((item) => {
    if (item.def_index !== 1201 && !item.casket_id != fromCasket) {
      let name = itemNames.nameItem(item);
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
