// Mock de react-native-svg para tests — lucide-react-native lo necesita
import React from "react";
import { View } from "react-native";

const SvgMock = ({ children, ...props }: any) =>
  React.createElement(View, props, children);

export default SvgMock;
export const Svg         = SvgMock;
export const Circle      = SvgMock;
export const Ellipse     = SvgMock;
export const G           = SvgMock;
export const Line        = SvgMock;
export const Path        = SvgMock;
export const Polygon     = SvgMock;
export const Polyline    = SvgMock;
export const Rect        = SvgMock;
export const Text        = SvgMock;
export const Defs        = SvgMock;
export const Stop        = SvgMock;
export const ClipPath    = SvgMock;
export const Mask        = SvgMock;
export const LinearGradient = SvgMock;
export const RadialGradient = SvgMock;
