declare module "react-simple-maps" {
  import { ReactNode, SVGProps, MouseEventHandler } from "react";

  interface Geography {
    rsmKey: string;
    id: string;
    properties: Record<string, unknown>;
  }

  interface GeographiesChildProps {
    geographies: Geography[];
    outline: unknown;
    borders: unknown;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (props: GeographiesChildProps) => ReactNode;
  }

  interface GeographyStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    cursor?: string;
    opacity?: number;
    [key: string]: unknown;
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: Geography;
    onMouseEnter?: MouseEventHandler<SVGPathElement>;
    onMouseLeave?: MouseEventHandler<SVGPathElement>;
    style?: {
      default?: GeographyStyle;
      hover?: GeographyStyle;
      pressed?: GeographyStyle;
    };
  }

  interface ComposableMapProps {
    projection?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
    [key: string]: unknown;
  }

  interface ZoomableGroupProps {
    zoom?: number;
    center?: [number, number];
    children?: ReactNode;
  }

  interface MarkerProps extends SVGProps<SVGGElement> {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
}
