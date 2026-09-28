import "./style.scss";

interface TextProps {
  content?: string;
}

const TextApp: React.FC<TextProps> = ({ content = "CIO" }) => {
  return (
    <div className="chromatic-text-preview">
      <div className="poster">
        <div className="bg-contour"></div>
        <div className="text">
          <span className="chromatic" data-text={content}>
            <span className="chromatic__base">{content}</span>
          </span>
          <span className="text-noise"></span>
        </div>
        <div className="blue-scribble"></div>
      </div>
    </div>
  );
};

export default TextApp;
