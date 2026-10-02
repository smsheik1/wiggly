import {
  createContext,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
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
  sourceOffsetSeconds?: number;
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
  clipTimeSeconds,
  sourceOffsetSeconds,
  ...props
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const sync = () => {
    if (sourceOffsetSeconds !== undefined && ref.current && Number.isFinite(clipTimeSeconds)) {
      ref.current.currentTime = clipTimeSeconds!;
    }
  };
  useEffect(sync, [clipTimeSeconds, sourceOffsetSeconds, props.src]);
  return <video {...props} ref={ref} onLoadedMetadata={sync} />;
};

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
