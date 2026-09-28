import { useId, useRef, useState, type KeyboardEvent } from "react";
import "./Select.scss";

const INITIAL_OPTIONS = ["Artboards", "Pages", "Templates"];

function Select() {
  const [selected, setSelected] = useState("Components");
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const suppressNextFocusOpenRef = useRef(false);

  const selectOption = (index: number) => {
    const nextSelected = options[index];
    setOptions((currentOptions) =>
      currentOptions.map((option, optionIndex) =>
        optionIndex === index ? selected : option,
      ),
    );
    setSelected(nextSelected);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = optionRefs.current.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      suppressNextFocusOpenRef.current = true;
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    } else {
      return;
    }

    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <section
      className="accessible-select-demo"
      aria-label="Accessible component selector"
      data-open={isOpen}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        if (
          !document.activeElement?.closest(".accessible-select-demo")
        ) {
          setIsOpen(false);
        }
      }}
      onFocusCapture={(event) => {
        if (
          suppressNextFocusOpenRef.current &&
          event.target === triggerRef.current
        ) {
          suppressNextFocusOpenRef.current = false;
          return;
        }
        setIsOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <span className="accessible-select-demo__label">ACCESSIBLE SELECT</span>
      <div className="accessible-select">
        <button
          ref={triggerRef}
          className="accessible-select__trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onClick={(event) =>
            setIsOpen((open) => (event.detail === 0 ? !open : true))
          }
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              optionRefs.current[0]?.focus();
            }
          }}
        >
          {selected}
        </button>
        <div
          className="accessible-select__menu"
          id={menuId}
          role="menu"
          aria-label="Components"
          aria-hidden={!isOpen}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((option, index) => (
            <button
              className="accessible-select__option"
              key={option}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={isOpen ? 0 : -1}
              onClick={() => selectOption(index)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Select;