const fetch = require("node-fetch");
const vdf = require("simple-vdf");

const ItemNames = class ItemNames {
  constructor() {
    this.items;
    this.names;
    this.skins;
    this.gameItems;
  }

  init() {
    return new Promise(async (resolve, reject) => {
      let { items, names, skins, gameItems } = await this.fetchFiles();
      this.items = items;
      this.names = names;
      this.skins = skins;
      this.gameItems = gameItems;
      resolve();
    });
  }

  nameItem(index, wear, paintIndex = null) {
    if (paintIndex) {
      let item = this.skins[paintIndex];
      let name = this.names[`PaintKit_${item.name}_Tag`];

      let prefab = this.items[index].prefab;
      let gameItem = this.gameItems[prefab];
      if (gameItem.prefab == "melee") return false;
      let prefabName = gameItem.item_name.replace("#", "");
      let baseItem = this.names[prefabName];
      //console.log(item);
      return baseItem + " | " + name + this.getCondition(wear);
    }
    let item = this.items[index];
    if (item.item_name == undefined) return false;
    let rawName = item.item_name.replace("#", "");
    let name = this.names[rawName];

    return name;
  }

  getCondition(float) {
    if (float < 0 || float > 100_000)
      throw Error(`Float out of Range - '${float}'`);

    switch (true) {
      case float < 0.07:
        return " (Factory New)";
      case float < 0.15:
        return " (Minimal Wear)";
      case float < 0.38:
        return " (Field-Tested)";
      case float < 0.45:
        return " (Well-Worn)";
      case float < 1:
        return " (Battle-Scarred)";
    }
  }

  fetchFiles() {
    return Promise.all([
      fetch(
        "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/scripts/items/items_game.txt"
      ).then((r) => r.text()),
      fetch(
        "https://raw.githubusercontent.com/SteamDatabase/GameTracking-CSGO/master/csgo/resource/csgo_english.txt"
      ).then((r) => r.text()),
    ]).then(([itemsGame, langTxt]) => {
      const [itemsGameJson, langJson] = [
        vdf.parse(itemsGame).items_game,
        vdf.parse(langTxt).lang.Tokens,
      ];
      return {
        items: itemsGameJson.items,
        names: langJson,
        skins: itemsGameJson.paint_kits,
        gameItems: itemsGameJson.prefabs,
      };
      //itemsGameJson.items; // these are all items, thisObject[def_index] gives back an item, where item_name is the item name (duh), but with an additional '#' in front of it
      //langJson // langJson[item_name] is the english item name
    });
  }
};

exports.ItemNames = ItemNames;
