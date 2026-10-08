import {
  createContext,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  useContext,
} from "react";

export type RenderImageComponent = ComponentType<{
  alt?: string;
  className?: string;
  src: string;
  style?: CSSProperties;
}>;

export type RenderVideoComponent = ComponentType<{
  active?: boolean;
  autoPlay?: boolean;
  className?: string;
  clipEndSeconds?: number;
  clipStartSeconds?: number;
  clipTimeSeconds?: number;
  loop?: boolean;
  muted?: boolean;
  onTimeUpdate?: (event: { currentTarget: { currentTime: number } }) => void;
  playsInline?: boolean;
  preload?: string;
  src: string;
  style?: CSSProperties;
}>;

const defaultImageComponent = "img" as unknown as RenderImageComponent;
const defaultVideoComponent: RenderVideoComponent = ({
  active: _active,
  clipEndSeconds: _clipEndSeconds,
  clipStartSeconds: _clipStartSeconds,
  clipTimeSeconds: _clipTimeSeconds,
  ...props
}) => <video {...props} />;

const RenderAssetContext = createContext<{
  Image: RenderImageComponent;
  Video: RenderVideoComponent;
}>({
  Image: defaultImageComponent,
  Video: defaultVideoComponent,
});

export function RenderAssetProvider({
  children,
  Image,
  Video = defaultVideoComponent,
}: {
  children: ReactNode;
  Image: RenderImageComponent;
  Video?: RenderVideoComponent;
}) {
  return (
    <RenderAssetContext.Provider value={{ Image, Video }}>
      {children}
    </RenderAssetContext.Provider>
  );
}

export function useRenderAssetComponents() {
  return useContext(RenderAssetContext);
}
