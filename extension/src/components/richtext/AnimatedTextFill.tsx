import { type HTMLAttributes, type ReactNode } from "react";
import "./AnimatedTextFill.scss";

export interface AnimatedTextFillProps
  extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  children?: ReactNode;
  text?: string;
}

const AnimatedTextFill = ({
  children,
  text,
  className = "",
  ...props
}: AnimatedTextFillProps) => {
  const content = children ?? text ?? "Spice up your type with CSS";

  return (
    <p {...props} className={`animated-text-fill ${className}`.trim()}>
      <span>{content}</span>
    </p>
  );
};

export default AnimatedTextFill;
