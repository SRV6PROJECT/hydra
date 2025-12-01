import type { Community } from "@types";

import { db } from "../level";
import { levelKeys } from "./keys";

export const communitiesSublevel = db.sublevel<string, Community>(
  levelKeys.communities,
  {
    valueEncoding: "json",
  }
);
