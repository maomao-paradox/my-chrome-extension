import "./SlicedText.scss";

interface SlicedTextProps {
  text?: string;
}

function SlicedText({ text = "Sliced" }: SlicedTextProps) {
  return (
    <div className="sliced-text-demo">
      <h2 className="sliced-text-demo__heading">
        <span className="sliced-text-demo__top">{text}</span>
        <span className="sliced-text-demo__bottom" aria-hidden="true">
          {text}
        </span>
      </h2>
    </div>
  );
}

export default SlicedText;
