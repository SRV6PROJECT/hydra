import {
  Modal,
  Button,
  TextField,
  TextAreaField,
  CheckboxField,
} from "@renderer/components";
import languageResources from "@locales";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Community,
  UserDetails,
  LibraryGame,
  CatalogueSearchResult,
} from "@types";
import {
  DeviceCameraIcon,
  TrashIcon,
  QuestionIcon,
} from "@primer/octicons-react";
import HydraIcon from "@renderer/assets/icons/hydra.svg?react";
import "./community-settings-modal.scss";
import { useTranslation } from "react-i18next";
import { useUserDetails, useToast } from "@renderer/hooks";
import { useSubscription } from "@renderer/hooks";
import { Badge } from "@renderer/components";
import { getSteamLanguage } from "@renderer/helpers";
import { debounce } from "lodash-es";

interface Props {
  visible: boolean;
  community: Community;
  me?: UserDetails | null;
  onClose: () => void;
  onSaved: (updated: Community) => void;
  onDeleted?: () => void;
}

export default function CommunitySettingsModal({
  visible,
  community,
  me,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [isOfficial, setIsOfficial] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [serverTag, setServerTag] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [library, setLibrary] = useState<LibraryGame[]>([]);
  const [gameQuery, setGameQuery] = useState("");
  const [selectedGames, setSelectedGames] = useState<
    NonNullable<Community["games"]>
  >([]);
  const { t, i18n } = useTranslation("communities");
  const { hasActiveSubscription } = useUserDetails();
  const { showHydraCloudModal } = useSubscription();
  const [activeTab, setActiveTab] = useState<
    "general" | "images" | "languages" | "games" | "danger" | "secure"
  >("general");
  const [genresMap, setGenresMap] = useState<Record<string, string[]>>({});
  const [catalogueSuggestions, setCatalogueSuggestions] = useState<
    CatalogueSearchResult[]
  >([]);
  const debouncedSearchRef = useRef<ReturnType<typeof debounce> | null>(null);
  const [serverTagError, setServerTagError] = useState<string>("");
  const [selectedAssetsMap, setSelectedAssetsMap] = useState<
    Record<
      string,
      {
        libraryImageUrl: string | null;
        coverImageUrl: string | null;
        iconUrl: string | null;
        libraryHeroImageUrl: string | null;
      }
    >
  >({});
  const [devUnlockCloud, setDevUnlockCloud] = useState<boolean>(false);
  const [blockCloudFeatures, setBlockCloudFeatures] = useState<boolean>(false);
  const [tempBlockCloudFeatures, setTempBlockCloudFeatures] =
    useState<boolean>(false);
  const cloudEnabled =
    (hasActiveSubscription && !blockCloudFeatures) || devUnlockCloud;

  useEffect(() => {
    if (community?.id) {
      try {
        const key = `hydra_block_cloud_features_${community.id}`;
        const saved = window.localStorage.getItem(key);
        if (saved !== null) {
          const isBlocked = saved === "1";
          setBlockCloudFeatures(isBlocked);
          setTempBlockCloudFeatures(isBlocked);
        }
      } catch (_e) {
        void 0;
      }
    }
  }, [community?.id]);
  const [avatarCleared, setAvatarCleared] = useState(false);
  const [coverCleared, setCoverCleared] = useState(false);
  const { showSuccessToast, showErrorToast, showWarningToast } = useToast();

  const renderTab = () => {
    if (activeTab === "general") {
      return (
        <div className="community-settings-modal__content">
          <TextField
            label={t("name_label")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
          <div className="community-settings-modal__field">
            <div className="community-settings-modal__field-header">
              <span>{t("description_label")}</span>
              <div className="community-details__char-counter">
                <span>{description.length}/200</span>
              </div>
            </div>
            <div className="community-settings-modal__field-input">
              <div className="community-settings-modal__field-inner">
                <TextAreaField
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  error={
                    description.length > 0 && description.length < 50
                      ? t("description_min_error")
                      : undefined
                  }
                />
              </div>
            </div>
          </div>

          <label className="community-settings-modal__label">
            {t("server_tag")}
          </label>
          <div className="community-settings-modal__pin-input">
            {Array.from({ length: 10 }).map((_, idx) => (
              <input
                key={idx}
                type="text"
                inputMode="text"
                maxLength={1}
                className="community-settings-modal__pin-box"
                value={serverTag[idx] ?? ""}
                onChange={(e) => {
                  const raw = (e.target.value || "")
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "")
                    .slice(0, 1);
                  if (!raw) return;
                  const merged = (
                    serverTag.slice(0, idx) +
                    raw +
                    serverTag.slice(idx + 1)
                  ).slice(0, 10);
                  setServerTag(merged);
                  setServerTagError("");
                  const next = (e.target as HTMLInputElement)
                    .nextElementSibling as HTMLInputElement | null;
                  next?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    e.preventDefault();
                    let next = serverTag;
                    if (idx < serverTag.length) {
                      next = serverTag.slice(0, idx) + serverTag.slice(idx + 1);
                    } else if (serverTag.length > 0) {
                      next = serverTag.slice(0, serverTag.length - 1);
                    }
                    setServerTag(next);
                    setServerTagError("");
                    const prev = (e.target as HTMLInputElement)
                      .previousElementSibling as HTMLInputElement | null;
                    prev?.focus();
                  }
                  if (e.key === "Delete") {
                    e.preventDefault();
                    if (idx < serverTag.length) {
                      const next =
                        serverTag.slice(0, idx) + serverTag.slice(idx + 1);
                      setServerTag(next);
                      setServerTagError("");
                    }
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const data = (e.clipboardData.getData("text") || "")
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "");
                  if (!data) return;
                  const prefix = serverTag.slice(0, idx);
                  const suffix = serverTag.slice(idx + data.length);
                  const merged = (prefix + data + suffix).slice(0, 10);
                  setServerTag(merged);
                  setServerTagError("");
                }}
              />
            ))}
          </div>
          {serverTagError && (
            <div className="community-settings-modal__error">
              {serverTagError}
            </div>
          )}

          <div className="community-settings-modal__checkbox-row">
            <CheckboxField
              label={t("closed_community")}
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
            />
          </div>
        </div>
      );
    }

    if (activeTab === "images") {
      return (
        <div className="community-settings-modal__content">
          <div className="community-settings-modal__images">
            <div className="community-settings-modal__avatar-picker">
              <div className="community-settings-modal__avatar">
                {!avatarCleared && (avatarUrl || community.avatarUrl) ? (
                  <img
                    className="community-settings-modal__avatar-image"
                    alt={community.name}
                    src={avatarUrl || community.avatarUrl || ""}
                    width={96}
                    height={96}
                  />
                ) : (
                  <div className="community-settings-modal__avatar-placeholder">
                    {(() => {
                      let s = 0 >>> 0;
                      const key = community.id || community.name || "?";
                      for (let i = 0; i < key.length; i++)
                        s = (s * 31 + key.charCodeAt(i)) >>> 0;
                      const next = () => (s = (s * 1664525 + 1013904223) >>> 0);
                      void next();
                      void next();
                      const cells: number[][] = [];
                      for (let r = 0; r < 5; r++) {
                        const row: number[] = [];
                        for (let c = 0; c < 3; c++)
                          row.push(next() % 3 === 0 ? 1 : 0);
                        cells.push(row);
                      }
                      return (
                        <svg
                          className="community-settings-modal__avatar--generated"
                          width={44}
                          height={44}
                          viewBox="0 0 5 5"
                          preserveAspectRatio="none"
                        >
                          {cells.map((row, r) =>
                            row.map((v, cIdx) => {
                              if (!v) return null;
                              const x1 = cIdx;
                              const x2 = 4 - cIdx;
                              const cls =
                                (cIdx + r) % 2
                                  ? "community-settings-modal__identicon-cell--a"
                                  : "community-settings-modal__identicon-cell--b";
                              return (
                                <g key={`r${r}c${cIdx}`}>
                                  <rect
                                    x={x1}
                                    y={r}
                                    width={1}
                                    height={1}
                                    className={cls}
                                  />
                                  <rect
                                    x={x2}
                                    y={r}
                                    width={1}
                                    height={1}
                                    className={cls}
                                  />
                                </g>
                              );
                            })
                          )}
                        </svg>
                      );
                    })()}
                  </div>
                )}
              </div>
              <Button
                theme="outline"
                onClick={() => handlePickImage("avatar")}
                className="community-settings-modal__button"
              >
                <DeviceCameraIcon /> {t("pick_avatar")}
              </Button>
              {!avatarCleared && (avatarUrl || community.avatarUrl) && (
                <Button
                  theme="danger"
                  onClick={() => {
                    setAvatarUrl("");
                    setAvatarCleared(true);
                    showSuccessToast("Аватар удалён");
                  }}
                  className="community-settings-modal__button"
                >
                  <TrashIcon /> {t("clear_avatar")}
                </Button>
              )}
            </div>

            <div className="community-settings-modal__cover-picker">
              <div className="community-settings-modal__cover-container">
                {!coverCleared && (coverImageUrl || community.coverImageUrl) ? (
                  <img
                    src={coverImageUrl || community.coverImageUrl || ""}
                    alt={community.name}
                    className="community-settings-modal__cover-preview"
                  />
                ) : (
                  <div className="community-settings-modal__cover-placeholder" />
                )}
                {!cloudEnabled && (
                  <button
                    type="button"
                    className="community-settings-modal__cover-overlay"
                    onClick={() => showHydraCloudModal("backup")}
                  >
                    <HydraIcon />
                    <span>{t("available_with_cloud")}</span>
                  </button>
                )}
              </div>
              <Button
                theme="outline"
                onClick={() =>
                  cloudEnabled
                    ? handlePickImage("cover")
                    : showHydraCloudModal("backup")
                }
                className="community-settings-modal__button"
                disabled={!cloudEnabled}
              >
                <DeviceCameraIcon /> {t("pick_cover")}
              </Button>
              {!coverCleared && (coverImageUrl || community.coverImageUrl) && (
                <Button
                  theme="danger"
                  onClick={() => {
                    setCoverImageUrl("");
                    setCoverCleared(true);
                    showSuccessToast("Обложка удалена");
                  }}
                  className="community-settings-modal__button"
                >
                  <TrashIcon /> {t("clear_cover")}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "languages") {
      return (
        <div className="community-settings-modal__language-selector">
          <label>{t("languages")}</label>
          <div className="community-settings-modal__language-list">
            {allLanguages.map((lang) => (
              <CheckboxField
                key={lang.code}
                label={lang.name}
                checked={selectedLanguages.includes(lang.code)}
                onChange={(e) =>
                  handleLanguageToggle(lang.code, e.target.checked)
                }
              />
            ))}
          </div>
          {selectedLanguages.length > 0 && (
            <ul className="community-settings-modal__selected-languages">
              {selectedLanguages.map((code) => {
                const name =
                  (languageResources as any)[code]?.language_name ?? code;
                return (
                  <li key={code}>
                    <span>{name}</span>
                    <button
                      type="button"
                      className="community-settings-modal__remove-language"
                      onClick={() =>
                        setSelectedLanguages((prev) =>
                          prev.filter((l) => l !== code)
                        )
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }

    if (activeTab === "secure") {
      return (
        <div className="community-settings-modal__content">
          <div className="community-settings-modal__section-title">
            {t("tab_secure")}
          </div>
          <div className="community-settings-modal__checkbox-row">
            <CheckboxField
              label={t("unlock_cloud_features")}
              checked={tempBlockCloudFeatures}
              onChange={(e) => {
                const checked = e.target.checked;
                setTempBlockCloudFeatures(checked);
              }}
            />
          </div>
          <div className="community-settings-modal__checkbox-row">
            <CheckboxField
              label={t("official_badge")}
              checked={isOfficial}
              onChange={(e) => setIsOfficial(e.target.checked)}
            />
          </div>
        </div>
      );
    }

    if (activeTab === "danger") {
      return (
        <div className="community-settings-modal__content">
          <div className="community-settings-modal__danger-section">
            <div className="community-settings-modal__section-title">
              {t("tab_danger")}
            </div>
            {isOwner && (
              <Button
                theme="danger"
                onClick={() => setShowDeleteConfirm(true)}
                className="community-settings-modal__button"
              >
                <TrashIcon /> {t("delete_community")}
              </Button>
            )}
            <div className="community-settings-modal__danger-warning">
              {t("danger_warning")}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="community-settings-modal__games-picker">
        <div className="community-settings-modal__section-title">
          {t("games")}
        </div>
        <TextField
          value={gameQuery}
          onChange={(e) => setGameQuery(e.target.value)}
          placeholder={t("game_name_placeholder")}
        />
        {gameQuery.trim().length > 0 && (
          <ul className="community-settings-modal__suggestions">
            {catalogueSuggestions.slice(0, 5).map((g) => {
              const cover = (g.libraryImageUrl ?? "")?.replaceAll("\\", "/");
              return (
                <li key={`${g.shop}-${g.objectId}`}>
                  <button
                    type="button"
                    className="community-settings-modal__suggestion"
                    onClick={() => {
                      if (selectedGames.length >= 6) {
                        showWarningToast("Достигнут максимум игр");
                        return;
                      }
                      const exists = selectedGames.some(
                        (sg) => sg.objectId === g.objectId && sg.shop === g.shop
                      );
                      if (exists) return;
                      setSelectedGames((prev) => [
                        ...prev,
                        { title: g.title, objectId: g.objectId, shop: g.shop },
                      ]);
                      setGameQuery("");
                    }}
                  >
                    <div className="community-settings-modal__suggestion-cover">
                      {cover ? (
                        <img src={cover} alt={g.title} />
                      ) : (
                        <div className="community-settings-modal__suggestion-cover-placeholder">
                          <QuestionIcon size={20} />
                        </div>
                      )}
                    </div>
                    <div className="community-settings-modal__suggestion-details">
                      <span className="community-settings-modal__suggestion-title">
                        {g.title}
                      </span>
                      <div className="community-settings-modal__suggestion-badges">
                        {(genresMap[`${g.shop}-${g.objectId}`] ?? [])
                          .slice(0, 3)
                          .map((genre) => (
                            <Badge key={genre}>{genre}</Badge>
                          ))}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedGames.length > 0 && (
          <div className="community-settings-modal__section-block">
            <div className="community-settings-modal__section-title">
              {t("pinned_games")}
            </div>
            <ul className="community-settings-modal__selected-games">
              {selectedGames.map((g) => {
                const key = `${g.shop}-${g.objectId}`;
                const fromLibrary = library.find(
                  (lg) => lg.objectId === g.objectId && lg.shop === g.shop
                );
                const fromAssets = selectedAssetsMap[key] ?? null;
                const cover = (
                  fromLibrary?.libraryImageUrl ??
                  fromLibrary?.coverImageUrl ??
                  fromLibrary?.iconUrl ??
                  fromLibrary?.libraryHeroImageUrl ??
                  fromAssets?.libraryImageUrl ??
                  fromAssets?.coverImageUrl ??
                  fromAssets?.iconUrl ??
                  fromAssets?.libraryHeroImageUrl ??
                  ""
                )?.replaceAll("\\", "/");

                return (
                  <li key={`${g.shop}-${g.objectId}`}>
                    <div className="community-settings-modal__selected-game-card">
                      <div className="community-settings-modal__selected-game-cover">
                        {cover ? (
                          <img src={cover} alt={g.title} />
                        ) : (
                          <div className="community-settings-modal__selected-game-cover-placeholder">
                            <QuestionIcon size={20} />
                          </div>
                        )}
                      </div>
                      <div className="community-settings-modal__selected-game-details">
                        <span className="community-settings-modal__selected-game-title">
                          {g.title}
                        </span>
                        <div className="community-settings-modal__selected-game-badges">
                          {(genresMap[`${g.shop}-${g.objectId}`] ?? [])
                            .slice(0, 3)
                            .map((genre) => (
                              <Badge key={genre}>{genre}</Badge>
                            ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="community-settings-modal__remove-game"
                        onClick={() =>
                          setSelectedGames((prev) =>
                            prev.filter(
                              (sg) =>
                                sg.objectId !== g.objectId || sg.shop !== g.shop
                            )
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const isOwner = useMemo(() => {
    return !!me && community.ownerId === me.id;
  }, [me, community]);

  const allLanguages = useMemo(() => {
    const keys = Object.keys(languageResources);
    return keys.map((k) => ({
      code: k,
      name: (languageResources as any)[k]?.language_name ?? k,
    }));
  }, []);

  const handleLanguageToggle = (code: string, checked: boolean) => {
    setSelectedLanguages((prev) => {
      if (checked) {
        if (prev.includes(code)) return prev;
        return [...prev, code];
      }
      return prev.filter((c) => c !== code);
    });
  };

  useEffect(() => {
    if (!visible) return;
    setName(community.name ?? "");
    setDescription(community.description ?? "");
    setAvatarUrl(community.avatarUrl ?? "");
    setCoverImageUrl(community.coverImageUrl ?? "");
    setIsOfficial(community.isOfficial ?? false);
    setIsClosed(community.isClosed ?? false);
    setServerTag(community.serverTag ?? "");
    setSelectedLanguages(community.languages ?? []);
    setSelectedGames(community.games ?? []);
    setAvatarCleared(false);
    setCoverCleared(false);
    try {
      const key = `hydra_dev_unlock_cloud_${community.id}`;
      const v = window.localStorage.getItem(key);
      setDevUnlockCloud(v === "1");
    } catch (_e) {
      void 0;
    }
  }, [community, visible]);

  useEffect(() => {
    window.electron
      .getLibrary()
      .then((lib) => setLibrary(lib || []))
      .catch(() => setLibrary([]));
  }, []);

  useEffect(() => {
    if (!debouncedSearchRef.current) {
      debouncedSearchRef.current = debounce(async (query: string) => {
        if (query.trim().length === 0) {
          setCatalogueSuggestions([]);
          return;
        }
        const response = await window.electron.hydraApi.post<{
          edges: CatalogueSearchResult[];
          count: number;
        }>("/catalogue/search", {
          data: {
            title: query,
            downloadSourceFingerprints: [],
            tags: [],
            publishers: [],
            genres: [],
            developers: [],
            take: 5,
            skip: 0,
            downloadSourceIds: [],
          },
          needsAuth: false,
        });
        setCatalogueSuggestions(response.edges);
      }, 400);
    }
  }, []);

  useEffect(() => {
    debouncedSearchRef.current?.(gameQuery);
  }, [gameQuery]);

  useEffect(() => {
    if (!visible) {
      setGameQuery("");
      setCatalogueSuggestions([]);
      setSelectedGames(community.games ?? []);
    }
  }, [visible, community]);

  useEffect(() => {
    const games = selectedGames;
    const missing = games
      .map((g) => ({ key: `${g.shop}-${g.objectId}`, g }))
      .filter(({ key }) => !(key in selectedAssetsMap));
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async ({ key, g }) => {
        const assets = await window.electron
          .getGameAssets(g.objectId, g.shop)
          .catch(() => null);
        return { key, assets };
      })
    ).then((items) => {
      const mapped: Record<string, any> = { ...selectedAssetsMap };
      for (const item of items) {
        if (item.assets) mapped[item.key] = item.assets;
      }
      setSelectedAssetsMap(mapped);
    });
  }, [selectedGames, selectedAssetsMap]);

  useEffect(() => {
    const language = getSteamLanguage(i18n.language);
    const needed = [
      ...selectedGames,
      ...catalogueSuggestions.slice(0, 5).map((g) => ({
        title: g.title,
        objectId: g.objectId,
        shop: g.shop,
      })),
    ];
    const missing = needed
      .map((g) => ({ key: `${g.shop}-${g.objectId}`, g }))
      .filter(({ key }) => !(key in genresMap));
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async ({ key, g }) => {
        const details = await window.electron
          .getGameShopDetails(g.objectId, g.shop as any, language)
          .catch(() => null);
        const genres = (details?.genres ?? [])
          .map((x: any) => (x?.name ?? x?.description ?? "").trim())
          .filter((v: string) => v.length > 0);
        return { key, genres };
      })
    ).then((items) => {
      const mapped: Record<string, string[]> = { ...genresMap };
      for (const item of items) {
        mapped[item.key] = item.genres;
      }
      setGenresMap(mapped);
    });
  }, [selectedGames, catalogueSuggestions, i18n.language, genresMap]);

  const handleSave = async () => {
    if (serverTag.trim().length > 0) {
      const isValid = /^[a-z0-9-]{1,20}$/.test(serverTag.trim());
      if (!isValid) {
        setServerTagError(
          "Тег может содержать только латиницу, цифры и '-', до 20 символов"
        );
        return;
      }
      const all = (await window.electron.getCommunities()) || [];
      const duplicate = all.some(
        (c: any) =>
          c.id !== community.id &&
          (c.serverTag || "").toLowerCase() === serverTag.trim().toLowerCase()
      );
      if (duplicate) {
        showErrorToast("Такой тег уже используется другим сообществом");
        return;
      }
    }
    const wasClosed = community.isClosed ?? false;
    const updated = await window.electron.updateCommunity(community.id, {
      name: name.trim(),
      description: description.trim(),
      avatarUrl: avatarUrl.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      isOfficial,
      isClosed,
      serverTag: serverTag.trim() || null,
      languages: selectedLanguages,
      games: selectedGames,
    });
    onSaved(updated);

    // Сохраняем настройки блокировки функций Hydra Cloud
    try {
      const key = `hydra_block_cloud_features_${community.id}`;
      window.localStorage.setItem(key, tempBlockCloudFeatures ? "1" : "0");
      setBlockCloudFeatures(tempBlockCloudFeatures);
    } catch (_e) {
      void 0;
    }

    showSuccessToast("Настройки сохранены");
    if (!wasClosed && isClosed) {
      showSuccessToast("Сообщество закрыто");
    }
    onClose();
  };

  const handlePickImage = async (type: "avatar" | "cover") => {
    const { filePaths } = await window.electron.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Image",
          extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
        },
      ],
    });

    if (!filePaths || filePaths.length === 0) return;
    const path = filePaths[0];

    const isSvg = path.toLowerCase().endsWith(".svg");
    let imagePath = path;
    if (!isSvg) {
      const processed = await window.electron
        .processProfileImage(path)
        .catch(() => ({ imagePath: null }));
      imagePath = processed.imagePath ?? path;
    }
    if (!imagePath.startsWith("http") && !imagePath.startsWith("local:")) {
      imagePath = `local:${imagePath}`;
    }
    if (type === "avatar") {
      setAvatarUrl(imagePath);
      setAvatarCleared(false);
      showSuccessToast("Аватар обновлён");
    } else {
      setCoverImageUrl(imagePath);
      setCoverCleared(false);
      showSuccessToast("Обложка обновлена");
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleDelete = async () => {
    await window.electron.deleteCommunity(community.id);
    onClose();
    onDeleted && onDeleted();
    showSuccessToast("Сообщество удалено");
  };

  return (
    <>
      <Modal
        visible={visible}
        title={t("community_settings")}
        onClose={onClose}
        large
        fullScroll
      >
        <form
          className="community-settings-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {null}
          <div className="community-settings-modal__tabs">
            <Button
              theme={activeTab === "general" ? "primary" : "outline"}
              onClick={() => setActiveTab("general")}
            >
              {t("tab_general")}
            </Button>
            <Button
              theme={activeTab === "images" ? "primary" : "outline"}
              onClick={() => setActiveTab("images")}
            >
              {t("tab_images")}
            </Button>
            <Button
              theme={activeTab === "languages" ? "primary" : "outline"}
              onClick={() => setActiveTab("languages")}
            >
              {t("tab_languages")}
            </Button>
            <Button
              theme={activeTab === "games" ? "primary" : "outline"}
              onClick={() => setActiveTab("games")}
            >
              {t("tab_games")}
            </Button>
            <Button
              theme={activeTab === "danger" ? "primary" : "outline"}
              onClick={() => setActiveTab("danger")}
            >
              {t("tab_danger")}
            </Button>
            <Button
              theme={activeTab === "secure" ? "primary" : "outline"}
              onClick={() => setActiveTab("secure")}
            >
              {t("tab_secure")}
            </Button>
          </div>
          <div className="community-settings-modal__tab-content">
            {renderTab()}
          </div>

          <div className="community-settings-modal__actions">
            <div className="community-settings-modal__actions-right">
              <Button
                theme="outline"
                onClick={onClose}
                className="community-settings-modal__button"
              >
                {t("cancel")}
              </Button>
              <Button
                theme="primary"
                onClick={handleSave}
                disabled={(() => {
                  const trim = (v: string | null | undefined) =>
                    (v ?? "").trim();
                  const json = (v: unknown) => JSON.stringify(v ?? null);
                  const hasChanges =
                    trim(name) !== trim(community.name) ||
                    trim(description) !== trim(community.description) ||
                    trim(avatarUrl) !== trim(community.avatarUrl) ||
                    trim(coverImageUrl) !== trim(community.coverImageUrl) ||
                    isOfficial !== (community.isOfficial ?? false) ||
                    isClosed !== (community.isClosed ?? false) ||
                    trim(serverTag) !== trim(community.serverTag) ||
                    json(selectedLanguages) !== json(community.languages) ||
                    json(selectedGames) !== json(community.games) ||
                    tempBlockCloudFeatures !== blockCloudFeatures;
                  return (
                    !hasChanges ||
                    (description.length > 0 && description.length < 50)
                  );
                })()}
                className="community-settings-modal__button"
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        visible={showDeleteConfirm}
        title={t("delete_community")}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <div className="community-settings-modal__delete-confirm">
          <p>{t("delete_confirm_message")}</p>
          <div className="community-settings-modal__actions">
            <Button
              theme="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="community-settings-modal__button"
            >
              {t("cancel")}
            </Button>
            <Button
              theme="danger"
              onClick={() => {
                setShowDeleteConfirm(false);
                handleDelete();
              }}
              className="community-settings-modal__button"
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
