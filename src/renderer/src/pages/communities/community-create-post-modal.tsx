import { Modal, Button, Badge } from "@renderer/components";
import { useUserDetails, useToast } from "@renderer/hooks";
import { useSubscription } from "@renderer/hooks/use-subscription";
import HydraIcon from "@renderer/assets/icons/hydra.svg?react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Community, UserDetails } from "@types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface Props {
  visible: boolean;
  community: Community;
  me: UserDetails | null;
  onClose: () => void;
  onCreated: (community: Community) => void;
}

export default function CommunityCreatePostModal({
  visible,
  community,
  me,
  onClose,
  onCreated,
}: Props) {
  const { t } = useTranslation("communities");
  const [charCount, setCharCount] = useState(0);
  const { hasActiveSubscription } = useUserDetails();
  const { showHydraCloudModal } = useSubscription();
  const { showSuccessToast } = useToast();
  const devUnlockCloud = (() => {
    try {
      const key = `hydra_dev_unlock_cloud_${community.id}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const blockCloudFeatures = (() => {
    try {
      const key = `hydra_block_cloud_features_${community.id}`;
      return window.localStorage.getItem(key) === "1";
    } catch (_e) {
      return false;
    }
  })();
  const cloudEnabled =
    (hasActiveSubscription && !blockCloudFeatures) || devUnlockCloud;
  const MAX_POST_CHARS = cloudEnabled ? 5000 : 1000;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "community-details__editor-content",
        "data-placeholder": t("write_post_placeholder"),
      },
      handlePaste: (view, event) => {
        const htmlContent = event.clipboardData?.getData("text/html") || "";
        const plainText = event.clipboardData?.getData("text/plain") || "";

        const currentText = view.state.doc.textContent;
        const remainingChars = MAX_POST_CHARS - currentText.length;

        if ((htmlContent || plainText) && remainingChars > 0) {
          event.preventDefault();

          if (htmlContent) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlContent;
            const textLength = tempDiv.textContent?.length || 0;

            if (textLength <= remainingChars) {
              return false;
            }
          }

          const truncatedText = plainText.slice(0, remainingChars);
          view.dispatch(view.state.tr.insertText(truncatedText));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setCharCount(text.length);

      if (text.length > MAX_POST_CHARS) {
        const truncatedContent = text.slice(0, MAX_POST_CHARS);
        editor.commands.setContent(truncatedContent);
        setCharCount(MAX_POST_CHARS);
      }
    },
  });

  useEffect(() => {
    if (!visible) {
      editor?.commands.setContent("");
      setCharCount(0);
    }
  }, [visible]);

  const handleCreate = async () => {
    const plain = editor?.getText().trim() || "";
    if (plain.length < 10) return;
    const authorId = me?.id ?? "local";
    await window.electron.addCommunityPost(community.id, {
      authorId,
      authorDisplayName: me?.displayName ?? "",
      authorProfileImageUrl: me?.profileImageUrl ?? null,
      content: editor?.getHTML() || "",
    });
    const updated = await window.electron.getCommunityById(community.id);
    onCreated(updated);
    onClose();
    showSuccessToast("Пост создан");
    editor?.commands.setContent("");
    setCharCount(0);
  };

  return (
    <Modal visible={visible} title={t("new_post")} onClose={onClose} large>
      <div className="community-create-post-modal__container">
        <div className="community-details__editor-form">
          <div className="community-details__editor-input-container">
            <div className="community-details__editor-input-header">
              <div className="community-details__editor-toolbar">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`community-details__editor-button ${editor?.isActive("bold") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`community-details__editor-button ${editor?.isActive("italic") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    editor?.chain().focus().toggleUnderline().run()
                  }
                  className={`community-details__editor-button ${editor?.isActive("underline") ? "is-active" : ""}`}
                  disabled={!editor}
                >
                  <u>U</u>
                </button>
              </div>
              <div className="community-details__char-counter">
                <span
                  className={charCount > MAX_POST_CHARS ? "over-limit" : ""}
                >
                  {charCount}/{MAX_POST_CHARS}
                </span>
                {!cloudEnabled && (
                  <button
                    type="button"
                    className="community-details__cloud-badge"
                    onClick={() => showHydraCloudModal("backup")}
                  >
                    <Badge>
                      <HydraIcon width={12} height={12} />{" "}
                      {t("hydra_cloud_limit")}
                    </Badge>
                  </button>
                )}
              </div>
            </div>
            <div className="community-details__editor-input">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
        <div className="community-create-post-modal__actions">
          <Button theme="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            theme="primary"
            onClick={handleCreate}
            disabled={(editor?.getText().trim().length || 0) < 10}
          >
            {t("create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
