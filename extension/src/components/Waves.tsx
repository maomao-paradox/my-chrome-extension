import wavesArtwork from "@/assets/icons/waves.svg";
import "./waves.scss";

const Waves = () => {
  return (
    <div className="bg-scroll-box">
      <div className="bg-content-box">
        <img src={wavesArtwork} alt="" className="bg" />
        <img src={wavesArtwork} alt="" className="bg" />
      </div>
    </div>
  );
};

export default Waves;
