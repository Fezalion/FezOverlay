import { omaewamou } from "./omaewamou";
import { heal } from "./heal";
import { shield } from "./shield";
import { kamehameha } from "./kamehameha";
import { lightning } from "./lightning";
import { shinraTensei } from "./shinraTensei";
import { cyclone } from "./cyclone";
import { judgmentCut } from "./judgmentCut";
import { bananaBomb } from "./bananaBomb";

export function createSkills(helpers) {
  return {
    omaewamou: omaewamou(helpers),
    heal: heal(helpers),
    shield: shield(helpers),
    kamehameha: kamehameha(helpers),
    lightning: lightning(helpers),
    shinraTensei: shinraTensei(helpers),
    cyclone: cyclone(helpers),
    judgmentCut: judgmentCut(helpers),
    bananaBomb: bananaBomb(helpers),
  };
}
