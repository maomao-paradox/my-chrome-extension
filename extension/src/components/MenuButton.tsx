import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Copy, Settings, Share2, Trash2 } from "lucide-react";
import "./menu-button.scss";

export type MenuAction = "settings" | "copy" | "share" | "delete";

interface MenuButtonProps {
  onAction?: (action: MenuAction) => void;
}

const MENU_ITEMS = [
  { id: "settings", label: "Settings", Icon: Settings },
  { id: "copy", label: "Copy", Icon: Copy },
  { id: "share", label: "Share", Icon: Share2 },
  { id: "delete", label: "Delete", Icon: Trash2 },
] as const;

function MenuButton({ onAction }: MenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusFirstAfterOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !focusFirstAfterOpenRef.current) return;
    focusFirstAfterOpenRef.current = false;
    itemRefs.current[0]?.focus();
  }, [isOpen]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const currentIndex = itemRefs.current.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % MENU_ITEMS.length;
    else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = MENU_ITEMS.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    } else {
      return;
    }

    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`menu-button${isOpen ? " menu-button--open" : ""}`}
    >
      <button
        ref={triggerRef}
        className="menu-button__trigger"
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            focusFirstAfterOpenRef.current = true;
            setIsOpen(true);
          } else if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            closeMenu();
          }
        }}
      >
        <span className="menu-button__icon" aria-hidden="true">
          <span className="menu-button__line menu-button__line--half menu-button__line--first" />
          <span className="menu-button__line" />
          <span className="menu-button__line menu-button__line--half menu-button__line--last" />
        </span>
      </button>
      <ul
        className="menu-button__list"
        id={menuId}
        role="menu"
        aria-label="More actions"
        aria-hidden={!isOpen}
        onKeyDown={handleMenuKeyDown}
      >
        {MENU_ITEMS.map(({ id, label, Icon }, index) => (
          <li className="menu-button__item" key={id} role="none">
            <button
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              className="menu-button__item-action"
              type="button"
              role="menuitem"
              tabIndex={isOpen ? 0 : -1}
              onClick={() => {
                onAction?.(id);
                closeMenu(true);
              }}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MenuButton;