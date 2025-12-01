import { appVersion, defaultDownloadsPath, isStaging } from "@main/constants";
import { ipcMain } from "electron";

import "./auth";
import "./autoupdater";
import "./catalogue";
import "./cloud-save";
import "./download-sources";
import "./hardware";
import "./library";
import "./leveldb";
import "./misc";
import "./notifications";
import "./profile";
import "./themes";
import "./torrenting";
import "./user";
import "./user-preferences";

import "./communities/get-communities";
import "./communities/create-community";
import "./communities/get-community-by-id";
import "./communities/update-community";
import "./communities/members";
import "./communities/posts";
import "./communities/join-leave";
import "./communities/delete-community";
import { isPortableVersion } from "@main/helpers";

ipcMain.handle("ping", () => "pong");
ipcMain.handle("getVersion", () => appVersion);
ipcMain.handle("isStaging", () => isStaging);
ipcMain.handle("isPortableVersion", () => isPortableVersion());
ipcMain.handle("getDefaultDownloadsPath", () => defaultDownloadsPath);
