import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import "./special.scss";

export interface AnimatedSearchProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  onValueChange?: (value: string) => void;
  onSubmitQuestion?: (value: string) => void;
}

const AnimatedSearch = ({
  value,
  defaultValue = "",
  placeholder = "Ask a question",
  label = "Animated search",
  onValueChange,
  onSubmitQuestion,
}: AnimatedSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isExpanded, setIsExpanded] = useState(false);
  const currentValue = value ?? internalValue;

  const updateValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  const toggleSearch = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    if (currentValue) {
      updateValue("");
      inputRef.current?.focus();
      return;
    }

    setIsExpanded(false);
  };

  const submit = () => {
    const question = currentValue.trim();
    if (!question) {
      inputRef.current?.focus();
      return;
    }
    onSubmitQuestion?.(question);
  };

  return (
    <div className={`special-search special-search--classic${isExpanded ? " is-expanded" : ""}`}>
      <span className="special-search__word special-search__word--start" aria-hidden="true">se</span>
      <div className="special-search__control">
        <button
          className="special-search__toggle"
          type="button"
          aria-label={isExpanded ? (currentValue ? "清空搜索" : "收起搜索") : "展开搜索"}
          aria-expanded={isExpanded}
          onClick={toggleSearch}
        >
          {isExpanded && !currentValue ? <X size={20} /> : <Search size={20} />}
        </button>
        <input
          ref={inputRef}
          className="special-search__input"
          aria-label={`${label}输入框`}
          autoComplete="off"
          maxLength={32}
          placeholder={isExpanded ? placeholder : ""}
          value={currentValue}
          onChange={(event) => updateValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              setIsExpanded(false);
            }
          }}
        />
      </div>
      <span className="special-search__word special-search__word--end" aria-hidden="true">rch</span>
    </div>
  );
};

export default AnimatedSearch;