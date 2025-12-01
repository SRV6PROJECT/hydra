import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Modal, TextField, Badge } from "@renderer/components";
import {
  CheckCircleFillIcon,
  PlusIcon,
  GlobeIcon,
  PeopleIcon,
  GearIcon,
  LockIcon,
} from "@primer/octicons-react";
import type { Community } from "@types";
import { useTranslation } from "react-i18next";
import { useUserDetails, useToast } from "@renderer/hooks";
import "./communities.scss";

function genCommunityIdenticon(key: string) {
  let s = 0 >>> 0;
  for (let i = 0; i < key.length; i++) s = (s * 31 + key.charCodeAt(i)) >>> 0;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0);
  const hue = next() % 360;
  const hue2 = (hue + 150 + (next() % 60)) % 360;
  const cells: number[][] = [];
  for (let r = 0; r < 5; r++) {
    const row: number[] = [];
    for (let c = 0; c < 3; c++) row.push(next() % 3 === 0 ? 1 : 0);
    cells.push(row);
  }
  return { cells, hue, hue2 };
}
export default function Communities() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation("communities");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "mine" | "manage">(
    "all"
  );
  const { userDetails } = useUserDetails();
  const { showSuccessToast } = useToast();

  const loadCommunities = async () => {
    try {
      setIsLoading(true);
      const list = await window.electron.getCommunities();
      setCommunities(list || []);
    } finally {
      setIsLoading(false);
    }
  };

  const canCreate = useMemo(() => {
    return name.trim().length > 2;
  }, [name]);

  const filteredCommunities = useMemo(() => {
    if (activeFilter === "all") return communities;
    const myId = userDetails?.id;
    if (!myId) return communities;
    if (activeFilter === "manage")
      return communities.filter((c) => c.ownerId === myId);
    return communities.filter((c) =>
      (c.members ?? []).some((m) => m.id === myId)
    );
  }, [communities, activeFilter, userDetails?.id]);

  const finalCommunities = useMemo(() => {
    const term = (searchParams.get("search") || "").trim().toLowerCase();
    if (!term) return filteredCommunities;
    return filteredCommunities.filter((c) => {
      const name = (c.name || "").toLowerCase();
      let qi = 0;
      for (let i = 0; i < name.length && qi < term.length; i++) {
        if (name[i] === term[qi]) qi++;
      }
      return qi === term.length;
    });
  }, [filteredCommunities, searchParams]);

  const allCount = communities.length;
  const mineCount = useMemo(() => {
    const myId = userDetails?.id;
    if (!myId) return 0;
    return communities.filter((c) =>
      (c.members ?? []).some((m) => m.id === myId)
    ).length;
  }, [communities, userDetails?.id]);
  const manageCount = useMemo(() => {
    const myId = userDetails?.id;
    if (!myId) return 0;
    return communities.filter((c) => c.ownerId === myId).length;
  }, [communities, userDetails?.id]);

  const handleCreate = async () => {
    try {
      setIsCreating(true);
      await window.electron.createCommunity(name.trim(), "");
      setShowCreateModal(false);
      setName("");
      await loadCommunities();
      showSuccessToast("Сообщество создано");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  return (
    <div className="communities">
      <div className="communities__header">
        <div className="communities__header-left">
          <div className="communities__filters">
            <div className="communities__filters-tab-wrapper">
              <button
                type="button"
                className={`communities__filters-tab ${
                  activeFilter === "all"
                    ? "communities__filters-tab--active"
                    : ""
                }`}
                onClick={() => setActiveFilter("all")}
              >
                <GlobeIcon size={14} /> {t("all_communities")}
                {allCount > 0 && (
                  <span className="communities__filters-tab-badge">
                    {allCount}
                  </span>
                )}
              </button>
              {activeFilter === "all" && (
                <motion.div
                  className="communities__filters-tab-underline"
                  layoutId="communities-tab-underline"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </div>
            <div className="communities__filters-tab-wrapper">
              <button
                type="button"
                className={`communities__filters-tab ${
                  activeFilter === "mine"
                    ? "communities__filters-tab--active"
                    : ""
                }`}
                onClick={() => setActiveFilter("mine")}
              >
                <PeopleIcon size={14} /> {t("your_communities")}
                {mineCount > 0 && (
                  <span className="communities__filters-tab-badge">
                    {mineCount}
                  </span>
                )}
              </button>
              {activeFilter === "mine" && (
                <motion.div
                  className="communities__filters-tab-underline"
                  layoutId="communities-tab-underline"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </div>
            <div className="communities__filters-tab-wrapper">
              <button
                type="button"
                className={`communities__filters-tab ${
                  activeFilter === "manage"
                    ? "communities__filters-tab--active"
                    : ""
                }`}
                onClick={() => setActiveFilter("manage")}
              >
                <GearIcon size={14} /> {t("manage_communities")}
                {manageCount > 0 && (
                  <span className="communities__filters-tab-badge">
                    {manageCount}
                  </span>
                )}
              </button>
              {activeFilter === "manage" && (
                <motion.div
                  className="communities__filters-tab-underline"
                  layoutId="communities-tab-underline"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </div>
          </div>
        </div>
        <Button theme="outline" onClick={() => setShowCreateModal(true)}>
          <PlusIcon size={14} /> {t("create_community")}
        </Button>
      </div>

      <div className="communities__grid">
        {isLoading ? (
          <div className="communities__placeholder">{t("loading")}</div>
        ) : (
          finalCommunities.map((c) => {
            const hasBanner = !!c.coverImageUrl;

            return (
              <button
                key={c.id}
                className="communities__card communities__card--clickable"
                onClick={() => navigate(`/communities/${c.id}`)}
              >
                {hasBanner ? (
                  <img
                    className="communities__banner"
                    src={c.coverImageUrl!}
                    alt={c.name}
                  />
                ) : (
                  <div className="communities__banner communities__banner--placeholder" />
                )}
                <div className="communities__card-content">
                  <div className="communities__card-header">
                    {c.avatarUrl ? (
                      <img
                        className="communities__avatar"
                        src={c.avatarUrl}
                        alt={c.name}
                      />
                    ) : (
                      (() => {
                        const icon = genCommunityIdenticon(
                          c.id || c.name || "?"
                        );
                        return (
                          <svg
                            className="communities__avatar--generated"
                            width={30}
                            height={30}
                            viewBox="0 0 5 5"
                            preserveAspectRatio="none"
                          >
                            {icon.cells.map((row, r) =>
                              row.map((v, cIdx) => {
                                if (!v) return null;
                                const x1 = cIdx;
                                const x2 = 4 - cIdx;
                                const cls =
                                  (cIdx + r) % 2
                                    ? "communities__identicon-cell--a"
                                    : "communities__identicon-cell--b";
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
                      })()
                    )}
                    <div className="communities__title-block">
                      <div className="communities__card-title communities__card-title--light">
                        {c.name}
                      </div>
                      {typeof c.membersCount === "number" && (
                        <div className="communities__members">
                          {t("members_count", { count: c.membersCount })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {(c.isOfficial || c.isClosed) && (
                  <div className="communities__overlay-badges">
                    {c.isOfficial && (
                      <Badge>
                        <CheckCircleFillIcon size={12} />
                        {t("official_badge")}
                      </Badge>
                    )}
                    {c.isClosed && (
                      <Badge>
                        <LockIcon size={12} /> {t("closed_community")}
                      </Badge>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      <Modal
        visible={showCreateModal}
        title={t("new_community")}
        description={t("new_community_description")}
        onClose={() => setShowCreateModal(false)}
      >
        <div className="communities__form">
          <TextField
            label={t("name_label")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
          />
          <div className="communities__form-actions">
            <Button theme="outline" onClick={() => setShowCreateModal(false)}>
              {t("cancel")}
            </Button>
            <Button
              theme="primary"
              disabled={!canCreate || isCreating}
              onClick={handleCreate}
            >
              <PlusIcon size={14} /> {t("create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
