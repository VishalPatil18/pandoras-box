import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./theme";
import { TIMELINE } from "./timeline";
import { Walkthrough } from "./Walkthrough";

export const RemotionRoot: React.FC = () => {
  return <Composition id="Walkthrough" component={Walkthrough} durationInFrames={TIMELINE.total} fps={FPS} width={WIDTH} height={HEIGHT} />;
};
